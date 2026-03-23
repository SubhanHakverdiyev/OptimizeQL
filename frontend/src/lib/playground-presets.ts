export interface SchemaPreset {
  name: string;
  label: string;
  description: string;
  ddl: string;
  sampleQuery: string;
}

export const PRESETS: SchemaPreset[] = [
  {
    name: "ecommerce",
    label: "E-Commerce",
    description: "Users, products, orders, order items",
    ddl: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category VARCHAR(100),
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending',
  total_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL
);`,
    sampleQuery: `SELECT u.email, COUNT(o.id) AS order_count, SUM(o.total_amount) AS total_spent
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.created_at >= NOW() - INTERVAL '90 days'
GROUP BY u.email
ORDER BY total_spent DESC
LIMIT 20;`,
  },
  {
    name: "blog",
    label: "Blog",
    description: "Users, posts, comments, tags",
    ddl: `CREATE TABLE authors (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500),
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  author_name VARCHAR(200),
  email VARCHAR(255),
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);`,
    sampleQuery: `SELECT p.title, a.username, COUNT(c.id) AS comment_count
FROM posts p
JOIN authors a ON a.id = p.author_id
LEFT JOIN comments c ON c.post_id = p.id
WHERE p.status = 'draft'
GROUP BY p.title, a.username
ORDER BY comment_count DESC;`,
  },
  {
    name: "saas",
    label: "SaaS",
    description: "Tenants, users, subscriptions, events",
    ddl: `CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  amount NUMERIC(10,2),
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER REFERENCES users(id),
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);`,
    sampleQuery: `SELECT t.name AS tenant, t.plan,
  COUNT(DISTINCT u.id) AS user_count,
  COUNT(e.id) AS event_count
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
LEFT JOIN events e ON e.tenant_id = t.id
  AND e.created_at >= NOW() - INTERVAL '30 days'
GROUP BY t.id, t.name, t.plan
HAVING COUNT(DISTINCT u.id) > 0
ORDER BY event_count DESC;`,
  },
];
