const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const Database = require('better-sqlite3');

// Initialize database
const db = new Database('skill_mosaic.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    difficulty TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    problem_id INTEGER,
    code TEXT,
    result TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (problem_id) REFERENCES problems (id)
  );
`);

// Insert default data if not exists
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)');
  insertUser.run('admin@skillmosaic.com', 'admin123', 'admin', 'Admin User');
  insertUser.run('candidate@skillmosaic.com', 'candidate123', 'candidate', 'John Doe');
  insertUser.run('recruiter@skillmosaic.com', 'recruiter123', 'recruiter', 'Jane Smith');
}

const problemCount = db.prepare('SELECT COUNT(*) as count FROM problems').get().count;
if (problemCount === 0) {
  const insertProblem = db.prepare('INSERT INTO problems (title, description, difficulty) VALUES (?, ?, ?)');
  insertProblem.run('Two Sum', 'Given an array of integers, return indices of two numbers that add up to target.', 'Easy');
  insertProblem.run('Reverse String', 'Write a function that reverses a string.', 'Easy');
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve static files
  if (pathname === '/' || pathname.endsWith('.html') || pathname.endsWith('.css') || pathname.endsWith('.js')) {
    let filePath = pathname === '/' ? 'login.html' : pathname.substring(1);
    filePath = path.join(__dirname, filePath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(data);
    });
  } else if (pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const { email, password, role } = JSON.parse(body);
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ? AND role = ?').get(email, password, role);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (user) {
        res.end(JSON.stringify({ success: true, message: 'Login successful', user: { id: user.id, name: user.name, role: user.role } }));
      } else {
        res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
      }
    });
  } else if (pathname === '/api/profile' && req.method === 'GET') {
    // Mock profile, but could fetch from DB
    const userId = 2; // Assume logged in user
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: user.name,
      email: user.email,
      role: user.role,
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: '3 years'
    }));
  } else if (pathname === '/api/problems' && req.method === 'GET') {
    const problems = db.prepare('SELECT * FROM problems').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(problems));
  } else if (pathname === '/api/submit' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const { problemId, code, userId } = JSON.parse(body);
      // Mock evaluation
      const passed = Math.random() > 0.5;
      const result = passed ? 'All tests passed!' : 'Some tests failed';
      // Insert submission
      const insert = db.prepare('INSERT INTO submissions (user_id, problem_id, code, result) VALUES (?, ?, ?, ?)');
      insert.run(userId || 2, problemId, code, result);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: passed, message: result }));
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

function getContentType(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'text/javascript';
    default: return 'text/plain';
  }
}

const port = 3000;
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});