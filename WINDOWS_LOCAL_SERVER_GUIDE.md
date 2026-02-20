# Windows Local Server Deployment Guide

This guide explains how to move your application from Railway to a **Local Windows Server** (e.g., a laptop) and how to connect to it from other devices on the same network.

## 📋 Prerequisites

1.  **Server Laptop**: The machine that will host the Database and Backend.
2.  **Client Laptop**: Any other machine on the same Wi-Fi/Ethernet network.
3.  **Software**: 
    *   [Node.js (LTS)](https://nodejs.org/) installed on the Server.
    *   [MySQL Installer for Windows](https://dev.mysql.com/downloads/installer/) installed on the Server.

---

## 🛠️ Step 1: MySQL Setup (Server Laptop)

1.  **Install MySQL**:
    *   Run the MySQL Installer.
    *   Choose "Server Only" or "Developer Default".
    *   Set a password for the `root` user (e.g., `admin123`).
2.  **Create Database**:
    *   Open **MySQL Workbench** or **MySQL Command Line**.
    *   Run the following commands:
        ```sql
        CREATE DATABASE shoe_factory;
        USE shoe_factory;
        ```
3.  **Initialize Tables**:
    *   Run the SQL scripts located in your project's `backend` folder. In the MySQL command line:
        ```sql
        SOURCE C:/path/to/Florence-IOT/backend/database_setup.sql;
        SOURCE C:/path/to/Florence-IOT/backend/masters_schema.sql;
        SOURCE C:/path/to/Florence-IOT/backend/production_routing_schema.sql;
        SOURCE C:/path/to/Florence-IOT/backend/production_planning_schema.sql;
        ```

---

## ⚙️ Step 2: Backend Configuration (Server Laptop)

1.  **Environment Variables**:
    *   Go to the `backend` folder.
    *   Edit (or create) the `.env` file:
        ```env
        PORT=3001
        DB_HOST=192.168.56.103
        DB_USER=root
        DB_PASSWORD=Shoe@123
        DB_NAME=shoe_factory

        # Directories
        INCOMING_DIR=../incoming
        SUCCESS_DIR=../success
        FAILURE_DIR=../failure
        LOGS_DIR=../logs
        ```
2.  **Install & Start**:
    ```bash
    cd backend
    npm install
    npm start
    ```

---

## 🌐 Step 3: Network & Firewall (Server Laptop)

To allow other laptops to connect, you must open the communication ports.

1.  **Find your Local IP**:
    *   Open Command Prompt (`cmd`).
    *   Type `ipconfig` and press Enter.
    *   Look for **IPv4 Address** (e.g., `192.168.1.15`). This is your **SERVER_IP**.
2.  **Open Firewall Ports**:
    *   Go to **Windows Defender Firewall** > **Advanced Settings**.
    *   Click **Inbound Rules** > **New Rule**.
    *   Select **Port** > **TCP**.
    *   Enter Specific local ports: `3000, 3001`.
    *   Select **Allow the connection**.
    *   Finish and name it "Florence-IOT".

---

## 💻 Step 4: Frontend Configuration

Since you are now using a local IP, the frontend needs to know where the backend is.

1.  **Update API Base**:
    *   In `frontend/src/services/api.ts` (and other components), change the `API_BASE` logic.
    *   Instead of checking only for `localhost`, it should use the current IP of the server.
    
    **Recommended Code Change:**
    ```typescript
    // In services/api.ts
    const SERVER_IP = '192.168.56.103'; // Put your actual Server IPv4 here
    const API_BASE = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001/api' 
      : `http://${window.location.hostname}:3001/api`;
    ```

2.  **Run Frontend with Network Access**:
    *   By default, Vite (the frontend tool) only listens to `localhost`. You must tell it to listen to the network:
    ```bash
    cd frontend
    npm run dev -- --host
    ```

---

## 🚀 Step 5: Connecting from Other Laptops

1.  Ensure both laptops are on the **same Wi-Fi**.
2.  On the **Client Laptop**, open a browser.
3.  Enter the URL: `http://[SERVER_IP]:3000` (e.g., `http://192.168.1.15:3000`).
4.  The app should load and connect to the backend running on your laptop.

---

## 💡 Summary of "Who runs what?"

| Component | Machine | Address |
| :--- | :--- | :--- |
| **MySQL Database** | Server Laptop | `localhost:3306` |
| **Backend API** | Server Laptop | `localhost:3001` |
| **Frontend Web** | Server Laptop | `localhost:3000` |
| **Accessing from Client** | Client Laptop | `http://[SERVER_IP]:3000` |

---

## ⚠️ Important Note on Static IPs
If your Wi-Fi restarts, your `SERVER_IP` might change (e.g., from `.15` to `.20`). If that happens, you need to update fthe IP address used on the client laptop. For a permanent setup, it is recommended to set a **Static IP** in your Windows Network Settings.
