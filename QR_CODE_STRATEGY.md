# QR Code & Production Setup Strategy

## 1. Database Setup (Fixing Empty Tables)
If your `users` and `employees` tables are empty, you need to run the **seeder script** provided in your backend. This will populate the `admin` user and demo machines.

**Run this command in your terminal:**
```bash
node backend/seed-demo-data.js
```

This will create:
- **User**: `admin` / `admin123`
- **Machines**: `MAC-001`, `MAC-002`, `MAC-003` (Codes: `M-001`, `M-002`, `M-003`)
- **Employees**: `EMP-1001`, `EMP-1002`

## 2. QR Code Strategy
To set up your lines, you need physical QR codes for each Machine and Employee. You can generate these at [qrcode.io](https://qrcode.io) or any similar site.

### A. Machine QR Codes
Generate a QR code containing **ONLY the Machine ID**.
*   **Content**: `MAC-001`
*   **Label**: Sticker this on "Stitching Machine 1".

*Repeat for `MAC-002`, `MAC-003`, etc.*

### B. Employee QR Codes
Generate a QR code containing **ONLY the Employee Code**.
*   **Content**: `EMP-1001`
*   **Label**: Name Badge for "John Doe".

## 3. The New Workflow (Implemented)
We have updated the code to support the exact workflow you requested:

1.  **Open Line Setup Form**: On the mobile device at the station, go to "Line Setup".
2.  **Scan User QR**: Scan the employee's badge (`EMP-1001`).
3.  **Scan Machine QR**: Scan the machine's code (`MAC-001`).
4.  **Auto-Launch**: The app will automatically redirect to a unique URL:
    `.../mobile/MAC-001/EMP-1001`
5.  **Production Screen**: The screen will immediately extract these IDs and initialize the production session without needing to wait for a server "pairing" code.
