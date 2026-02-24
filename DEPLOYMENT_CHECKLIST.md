# Machine Centre Production - Deployment Checklist

## 📋 PRE-DEPLOYMENT CHECKLIST

### Database Preparation
- [ ] Backup existing database
  ```bash
  mysqldump -u root -p shoe_factory > backup_$(date +%Y%m%d).sql
  ```

- [ ] Run migration script
  ```bash
  mysql -u root -p shoe_factory < backend/add-target-pairs-column-migration.sql
  ```

- [ ] Verify new columns exist
  ```sql
  DESCRIBE machine_centre_app;
  DESCRIBE pivot_data;
  -- Should see target_pairs and total_target_pairs columns
  ```

- [ ] Test with sample data
  ```sql
  INSERT INTO machine_centre_app 
  (prod_date, work_centre_id, machine_id, emp_id, target_mins, target_pairs, start_time, button_status)
  VALUES (CURDATE(), 1, 101, 'EMP001', 60, 12, NOW(), 1);
  
  SELECT * FROM machine_centre_app WHERE machine_id = 101;
  ```

### Backend Preparation
- [ ] Update `.env` file with production values
  ```env
  DB_HOST=your_production_host
  DB_PORT=3306
  DB_USER=your_db_user
  DB_PASSWORD=your_secure_password
  DB_NAME=shoe_factory
  PORT=3001
  NODE_ENV=production
  ```

- [ ] Install dependencies
  ```bash
  cd backend
  npm install --production
  ```

- [ ] Test database connection
  ```bash
  node test-db-connection.js
  ```

- [ ] Verify all API endpoints
  ```bash
  # Start server
  npm start
  
  # Test health endpoint
  curl http://localhost:3001/health
  ```

### Frontend Preparation
- [ ] Update API base URL if needed
  ```typescript
  // In MachineCentreProduction.tsx
  const API_BASE = `${window.location.protocol}//${window.location.hostname}:3001/api`;
  ```

- [ ] Install dependencies
  ```bash
  cd frontend
  npm install
  ```

- [ ] Build for production
  ```bash
  npm run build
  ```

- [ ] Test production build locally
  ```bash
  npm run preview
  ```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Backend
- [ ] Copy backend files to server
  ```bash
  scp -r backend/ user@server:/path/to/app/
  ```

- [ ] Install PM2 globally (if not installed)
  ```bash
  npm install -g pm2
  ```

- [ ] Start with PM2
  ```bash
  cd backend
  pm2 start src/app.js --name "shoe-factory-backend"
  pm2 save
  pm2 startup
  ```

- [ ] Verify backend is running
  ```bash
  pm2 status
  pm2 logs shoe-factory-backend
  curl http://localhost:3001/health
  ```

### Step 2: Deploy Frontend
- [ ] Copy dist folder to web server
  ```bash
  scp -r frontend/dist/ user@server:/var/www/shoe-factory/
  ```

- [ ] Configure web server (Nginx example)
  ```nginx
  server {
      listen 80;
      server_name your-domain.com;
      root /var/www/shoe-factory/dist;
      index index.html;
      
      location / {
          try_files $uri $uri/ /index.html;
      }
      
      location /api {
          proxy_pass http://localhost:3001;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```

- [ ] Restart web server
  ```bash
  sudo systemctl restart nginx
  ```

### Step 3: Configure Firewall
- [ ] Open necessary ports
  ```bash
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw allow 3001/tcp  # Backend API
  ```

### Step 4: SSL Certificate (Production)
- [ ] Install Certbot
  ```bash
  sudo apt install certbot python3-certbot-nginx
  ```

- [ ] Obtain SSL certificate
  ```bash
  sudo certbot --nginx -d your-domain.com
  ```

- [ ] Verify auto-renewal
  ```bash
  sudo certbot renew --dry-run
  ```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Backend Tests
- [ ] Health check endpoint
  ```bash
  curl https://your-domain.com/api/health
  # Expected: {"status":"ok"}
  ```

- [ ] Machine status endpoint
  ```bash
  curl https://your-domain.com/api/machine-centre/status/101
  # Expected: {"success":true,"data":{...}}
  ```

- [ ] Database connectivity
  ```bash
  pm2 logs shoe-factory-backend --lines 50
  # Check for "Database connected successfully"
  ```

### Frontend Tests
- [ ] Access main page
  ```
  https://your-domain.com
  ```

- [ ] Navigate to Machine Centre Production
  ```
  https://your-domain.com/mobile/machine-centre
  ```

- [ ] Test QR code scanning
  - [ ] Scan machine QR code
  - [ ] Scan employee QR code
  - [ ] Verify session starts

- [ ] Test timer functionality
  - [ ] Press START button
  - [ ] Wait 1 minute
  - [ ] Verify actual_time increments

- [ ] Test STOP/RESUME
  - [ ] Press STOP button
  - [ ] Verify timer pauses
  - [ ] Press START button
  - [ ] Verify timer resumes

- [ ] Test FINISH
  - [ ] Press FINISH button
  - [ ] Enter output pairs
  - [ ] Verify data saved to database

### Mobile Device Tests
- [ ] Test on Android phone
  - [ ] Portrait orientation
  - [ ] Landscape orientation
  - [ ] Camera access for QR scanning

- [ ] Test on iOS device
  - [ ] Portrait orientation
  - [ ] Landscape orientation
  - [ ] Camera access for QR scanning

- [ ] Test on tablet
  - [ ] 7-inch tablet
  - [ ] 10-inch tablet

### Performance Tests
- [ ] Page load time < 3 seconds
- [ ] API response time < 200ms
- [ ] Timer accuracy (check after 10 minutes)
- [ ] Memory usage stable (no leaks)

### Database Tests
- [ ] Verify data insertion
  ```sql
  SELECT * FROM machine_centre_app 
  WHERE prod_date = CURDATE() 
  ORDER BY id DESC LIMIT 5;
  ```

- [ ] Verify pivot data aggregation
  ```sql
  SELECT * FROM pivot_data 
  WHERE prod_date = CURDATE();
  ```

- [ ] Check indexes
  ```sql
  SHOW INDEX FROM machine_centre_app;
  SHOW INDEX FROM pivot_data;
  ```

---

## 🔍 MONITORING SETUP

### Log Monitoring
- [ ] Set up log rotation
  ```bash
  # /etc/logrotate.d/shoe-factory
  /path/to/backend/logs/*.log {
      daily
      rotate 7
      compress
      delaycompress
      notifempty
      create 0640 www-data www-data
  }
  ```

- [ ] Monitor PM2 logs
  ```bash
  pm2 logs shoe-factory-backend --lines 100
  ```

### Database Monitoring
- [ ] Set up slow query log
  ```sql
  SET GLOBAL slow_query_log = 'ON';
  SET GLOBAL long_query_time = 2;
  ```

- [ ] Monitor table sizes
  ```sql
  SELECT 
      table_name,
      ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "Size (MB)"
  FROM information_schema.TABLES
  WHERE table_schema = 'shoe_factory'
  ORDER BY (data_length + index_length) DESC;
  ```

### Performance Monitoring
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Configure error alerting
- [ ] Monitor API response times
- [ ] Track database query performance

---

## 🐛 TROUBLESHOOTING GUIDE

### Issue: Backend not starting
**Check:**
```bash
pm2 logs shoe-factory-backend --err
# Look for database connection errors
# Verify .env file exists and has correct values
```

**Fix:**
```bash
# Test database connection
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# Restart backend
pm2 restart shoe-factory-backend
```

### Issue: Timer not updating
**Check:**
```javascript
// Browser console
console.log('Session ID:', sessionId);
console.log('Button Status:', status?.button_status);
```

**Fix:**
- Verify sessionId is set
- Check button_status = 1
- Verify API endpoint is reachable
- Check browser console for errors

### Issue: Status stuck on Idle
**Check:**
```sql
SELECT id, machine_id, button_status, updated_at, actual_time, target_mins
FROM machine_centre_app
WHERE machine_id = 101 AND prod_date = CURDATE();
```

**Fix:**
- Verify button_status is correct
- Check updated_at timestamp
- Ensure timer is running
- Verify calculateStatus logic

### Issue: QR scanner not working
**Check:**
- Camera permissions granted
- HTTPS enabled (required for camera access)
- QR code format is valid JSON
- Browser supports getUserMedia API

**Fix:**
```bash
# Ensure SSL certificate is installed
sudo certbot certificates

# Test camera access
# Navigate to: chrome://settings/content/camera
```

### Issue: Database connection lost
**Check:**
```bash
pm2 logs shoe-factory-backend --lines 50
# Look for "Connection lost" or "ECONNREFUSED"
```

**Fix:**
```bash
# Restart MySQL
sudo systemctl restart mysql

# Restart backend
pm2 restart shoe-factory-backend

# Check MySQL status
sudo systemctl status mysql
```

---

## 📊 PERFORMANCE OPTIMIZATION

### Database Optimization
- [ ] Add indexes if missing
  ```sql
  CREATE INDEX idx_machine_date ON machine_centre_app(machine_id, prod_date);
  CREATE INDEX idx_button_status ON machine_centre_app(button_status);
  ```

- [ ] Optimize queries
  ```sql
  EXPLAIN SELECT * FROM machine_centre_app WHERE machine_id = 101;
  # Should use idx_machine_date index
  ```

- [ ] Clean old data
  ```sql
  -- Archive data older than 90 days
  DELETE FROM machine_centre_app WHERE prod_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY);
  ```

### Frontend Optimization
- [ ] Enable gzip compression (Nginx)
  ```nginx
  gzip on;
  gzip_types text/plain text/css application/json application/javascript;
  ```

- [ ] Set cache headers
  ```nginx
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
      expires 1y;
      add_header Cache-Control "public, immutable";
  }
  ```

### Backend Optimization
- [ ] Enable connection pooling
  ```javascript
  // In database.js
  const pool = mysql.createPool({
      connectionLimit: 10,
      queueLimit: 0
  });
  ```

- [ ] Add response compression
  ```javascript
  // In app.js
  const compression = require('compression');
  app.use(compression());
  ```

---

## 🔐 SECURITY CHECKLIST

- [ ] Change default database passwords
- [ ] Disable root login over network
- [ ] Enable firewall (ufw/iptables)
- [ ] Install SSL certificate
- [ ] Set secure session cookies
- [ ] Enable CORS only for trusted domains
- [ ] Sanitize all user inputs
- [ ] Use parameterized SQL queries
- [ ] Keep dependencies updated
- [ ] Set up regular backups
- [ ] Monitor access logs
- [ ] Implement rate limiting

---

## 📅 MAINTENANCE SCHEDULE

### Daily
- [ ] Check PM2 status
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review slow query log
- [ ] Check database size
- [ ] Test backup restoration
- [ ] Update dependencies

### Monthly
- [ ] Security updates
- [ ] Performance review
- [ ] Archive old data
- [ ] User feedback review

---

## 📞 SUPPORT CONTACTS

**Technical Issues:**
- Backend: Check `backend/logs/error.log`
- Frontend: Check browser console
- Database: Check MySQL error log

**Emergency Contacts:**
- Database Admin: [contact]
- System Admin: [contact]
- Developer: [contact]

---

## ✅ DEPLOYMENT COMPLETE

Once all items are checked:
- [ ] Document deployment date and version
- [ ] Notify users of new feature
- [ ] Provide training if needed
- [ ] Monitor for first 24 hours
- [ ] Collect user feedback

**Deployment Date:** _______________
**Deployed By:** _______________
**Version:** 1.0.0
**Status:** ✅ Production Ready

---

**Congratulations! Your Machine Centre Production Monitoring System is now live!** 🎉
