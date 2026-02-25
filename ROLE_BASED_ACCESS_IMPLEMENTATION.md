# Role-Based Access Control Implementation

## Summary of Changes

### 1. **LoginForm.tsx** - Removed User Type Dropdown
- Removed the User Type dropdown from login form
- Login now reads user role from database (stored in `users.role` field)
- Role is retrieved from `user_info` in sessionStorage after successful login
- Navigation is based on role from database

### 2. **UsersMasterForm.tsx** - Added User Type Dropdown
- Changed "Role" dropdown label to "User Type *" (required field)
- Updated dropdown options to include 6 user types:
  - Admin
  - Line Supervisor
  - Machine Centre User
  - IED
  - Planner
  - Unit Head
- Default role changed from 'user' to 'Admin'
- Role is saved to database `users.role` field

### 3. **Navigation.tsx** - Read Role from Database
- Removed dependency on `getUserRole()` from roleConfig
- Created `getUserRoleFromSession()` function to read role from `user_info` in sessionStorage
- Role is now pulled from database via sessionStorage instead of separate `user_role` key
- Removed `user_role` from logout cleanup (only clears `user_info`)

### 4. **roleConfig.ts** - Simplified Role Management
- Removed `getUserRole()` and `setUserRole()` functions (no longer needed)
- Updated `isMenuAllowed()` and `getDefaultRoute()` to accept string type for role
- Removed 'mobile' from all role configurations (duplicate of production_tracker)
- Role configuration remains the same with 6 user types

## User Role Permissions

| User Type | Default Route | Allowed Menus |
|-----------|---------------|---------------|
| **Admin** | TV Dashboard | All menus (Masters, Process, Setup) |
| **Line Supervisor** | TV Dashboard | TV Dashboard, Line Setup, Production Tracker, Reports |
| **Machine Centre User** | Production Tracker | Production Tracker only |
| **IED** | TV Dashboard | TV Dashboard, Production Routing, Production Tracker, Reports |
| **Planner** | TV Dashboard | TV Dashboard, Masters (all), Production Planning, Production Tracker, Reports |
| **Unit Head** | TV Dashboard | TV Dashboard, Production Tracker, Reports |

## Database Schema

The `users` table should have the following structure:
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'Admin',
  work_centre_id INT,
  machine_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_centre_id) REFERENCES work_centres(id)
);
```

## How It Works

1. **User Creation**: Admin creates user at `/users` page and selects User Type from dropdown
2. **Role Storage**: User Type is saved to `users.role` field in database
3. **Login**: User logs in with login/password (no User Type selection)
4. **Role Retrieval**: Backend returns user data including `role` field
5. **Session Storage**: Frontend stores complete user object in `user_info` sessionStorage
6. **Menu Filtering**: Navigation component reads role from `user_info` and filters menus accordingly
7. **Route Protection**: Default route is determined based on user's role from database

## Testing Steps

1. **Create Test Users**:
   - Go to `/users` page
   - Create users with different User Types
   - Verify role is saved in database

2. **Test Login**:
   - Login with each user type
   - Verify correct menus are displayed
   - Verify navigation to correct default route

3. **Test Menu Access**:
   - Try accessing different menu items
   - Verify only allowed menus are visible
   - Verify role persists across page refreshes

## Migration Notes

- Existing users in database may have old role values ('user', 'admin', 'supervisor')
- Update existing users to use new role values:
  ```sql
  UPDATE users SET role = 'Admin' WHERE role = 'admin';
  UPDATE users SET role = 'Line Supervisor' WHERE role = 'supervisor';
  UPDATE users SET role = 'Machine Centre User' WHERE role = 'user';
  ```

## Files Modified

1. `frontend/src/components/LoginForm.tsx`
2. `frontend/src/components/UsersMasterForm.tsx`
3. `frontend/src/components/Navigation.tsx`
4. `frontend/src/utils/roleConfig.ts`

## Backend Files (No Changes Required)

- `backend/src/controllers/masterController.js` - Already handles role field correctly
- `backend/src/controllers/authController.js` - Already returns user data with role
