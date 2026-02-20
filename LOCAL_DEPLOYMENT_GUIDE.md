# Windows Local Server & VM Deployment Guide

This guide explains how to deploy your application on a **Windows Server VM** or a **Local Windows Machine**, and how to ensure connectivity between different laptops and VMs.

## 🏢 Scenario: Using a VM (Windows Server) on your Laptop

To allow your **Host Laptop** and **Other Laptops** to connect to the VM:

### 1. Network Adapter Setting (VERY IMPORTANT)
You must change the VM Network settings (e.g., in VirtualBox or VMware):
*   **Set to: Bridged Adapter**. 
*   **Why?** This makes the VM appear as a separate physical computer on your Wi-Fi network. It will get its own IP address (e.g., `192.168.1.50`).
*   **Result**: 
    - Your host laptop can access it via `http://192.168.1.50:3000`.
    - Other laptops on the same Wi-Fi can also access it via `http://192.168.1.50:3000`.

### 2. Identify the VM IP
Inside the Windows Server VM:
1.  Open Command Prompt (`cmd`).
2.  Type `ipconfig`.
3.  Note the **IPv4 Address** (e.g., `192.168.1.50`). This is your **`SERVER_IP`**.


---

## 🛠️ Step 1: MySQL Setup (On the Server VM/Laptop)

1.  **Install MySQL**: Use the Windows Installer.
2.  **Allow Remote Connections** (If connecting from other laptops):
    *   During installation, ensure the firewall allows port `3306`.
    *   In MySQL Workbench, create a user that can connect from any host:
        ```sql
        CREATE USER 'admin'@'%' IDENTIFIED BY 'your_password';
        GRANT ALL PRIVILEGES ON shoe_factory.* TO 'admin'@'%';
        FLUSH PRIVILEGES;
        ```
3.  **Run Tables**: Import `database_setup.sql`, `masters_schema.sql`, etc., into the `shoe_factory` database.

---

## ⚙️ Step 2: Backend Configuration

1.  Open `backend/.env`.
2.  Set `DB_HOST=localhost` (if MySQL is in the same VM).
3.  Ensure `PORT=3001`.
4.  Run `npm install` and `npm start`.

---

## 🌐 Step 3: Deployment-Ready Frontend

Your current code hardcodes the Railway URL when not on `localhost`. To make it work on your local network (IP-based), update the API logic.

### Recommended Change in `frontend/src/services/api.ts`:
Replace the hardcoded URL with this dynamic logic:

```typescript
const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname.startsWith('192.168.') || 
                window.location.hostname.startsWith('10.') ||
                window.location.hostname.endsWith('.local');

// This uses the same IP you used to open the website, but changes the port to 3001
const API_BASE = isLocal 
  ? `http://${window.location.hostname}:3001/api`
  : 'https://shoe-factory-monitoring-production-8c06.up.railway.app/api';
```

---

## 🛡️ Step 4: Windows Firewall (Server VM)

Windows Server is very strict. You MUST manually open the ports:
1.  Search for **"Windows Defender Firewall with Advanced Security"**.
2.  **Inbound Rules** -> **New Rule**.
3.  **Port** -> **TCP**.
4.  **Specific local ports**: `3000, 3001, 3306`.
5.  **Allow the connection**.
6.  Name it "Florence IOT Services".

---

## 🚀 Step 5: Connectivity Test

### From Host Laptop to VM:
1.  Run the frontend on the VM: `npm run dev -- --host` (The `--host` flag is required to listen on the network IP).
2.  On your Host Laptop browser, go to: `http://[SERVER_IP]:3000`.

### From Another Laptop to Server:
1.  Ensure both are on the same Wi-Fi.
2.  Visit `http://[SERVER_IP]:3000`.

---

## 📝 Summary Checklist
- [ ] VM Network set to **Bridged**.
- [ ] MySQL installed and schema imported.
- [ ] Firewalls ports **3000 & 3001** opened on the Server.
- [ ] Frontend running with `npm run dev -- --host`.
- [ ] `API_BASE` updated in code to use `window.location.hostname`.
