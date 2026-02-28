# Instructions to Replace Browser Confirm Dialogs

All files need the following changes:

## 1. Import ConfirmDialog
Add to imports:
```typescript
import { ConfirmDialog } from './ConfirmDialog';
```

## 2. Add State
Add state variable:
```typescript
const [deleteId, setDeleteId] = useState<number | null>(null);
```

## 3. Update handleDelete
Replace:
```typescript
const handleDelete = async (id: number) => {
  if (!confirm('Delete message?')) return;
  try {
    // delete logic
  }
}
```

With:
```typescript
const handleDelete = (id: number) => {
  setDeleteId(id);
};

const confirmDelete = async () => {
  if (!deleteId) return;
  setDeleteId(null);
  try {
    // delete logic (use deleteId instead of id)
  }
};
```

## 4. Add Dialog Component
Add before the main return JSX:
```typescript
<ConfirmDialog
  isOpen={deleteId !== null}
  title="Delete [Item]"
  message="Are you sure you want to delete this [item]? This action cannot be undone."
  onConfirm={confirmDelete}
  onCancel={() => setDeleteId(null)}
  confirmText="Delete"
/>
```

## Files to Update:
1. ✅ ProductionRoutingForm.tsx - DONE
2. ProductionPlanningForm.tsx
3. EmployeeMasterForm.tsx
4. FormsMasterForm.tsx
5. MasterForm.tsx
6. UsersMasterForm.tsx
