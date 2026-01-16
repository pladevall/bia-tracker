# Quick Event Input Options - Implementation Guide

## Overview
Three prototyped approaches to speed up event creation. Each has different UX tradeoffs.

---

## Option 2: Text-Based Quick Add (Natural Language Parsing)

### How It Works
- User presses **Cmd+K** to open command palette
- Types: `"Shipped MVP Jun 14-20 Deep Work"`
- System parses the text and creates event
- Instant feedback with event preview before confirming

### Implementation Steps
1. Create a command palette component using keyboard shortcut
2. Add text parser to extract:
   - Event name (quoted or first portion)
   - Date range (e.g., "Jun 14-20", "June 14 to 20", "next week")
   - Category (matches against known categories)
3. Show inline validation and error messages
4. Require Enter to confirm or Escape to cancel

### Challenges
- Users need to learn the format
- Date parsing errors are common
- Less visual feedback compared to other options

### When to Use
- Power users who like CLI-style input
- When keyboard focus is already there
- For advanced workflows

### Complexity: Medium (regex parsing + date parsing)

---

## Option 3: Right-Click Quick Menu ✅ PROTOTYPED

### How It Works
1. User right-clicks on any day
2. Quick menu appears with:
   - Text input for event title
   - Category selector (click or press 1-4)
   - "Create" button or press Enter
3. Single-day event is created instantly
4. Menu closes, ready for next day

### Implementation Steps
1. Add `onContextMenu` handler to `DayCell` component
2. Show `QuickEventMenu` component (already created)
3. Menu captures keyboard shortcuts for category selection
4. On Enter/Create, saves event to Supabase
5. Calls `onEventCreated()` to refresh calendar

### Advantages
- ✅ Natural interaction (right-click is familiar)
- ✅ Quick for single-day events
- ✅ Visual feedback with category colors
- ✅ Keyboard shortcuts (1-4 for categories)
- ✅ Can chain: right-click multiple days rapidly

### Challenges
- Single-day only (for date ranges, need main modal)
- Right-click context menu can vary by browser
- Menu positioning might go off-screen

### When to Use
- Creating single-day events frequently
- Quick daily logging
- Mobile: long-press instead of right-click

### Complexity: Low (component already created)

### Integration Code
```tsx
// In day-cell.tsx
const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
};

return (
    <div onContextMenu={handleContextMenu}>
        {/* existing content */}
        <QuickEventMenu
            date={date}
            isOpen={!!contextMenu}
            position={contextMenu || { x: 0, y: 0 }}
            onClose={() => setContextMenu(null)}
            onEventCreated={refreshEvents}
        />
    </div>
);
```

---

## Option 4: Batch Input Mode ✅ PROTOTYPED

### How It Works
1. User presses **Ctrl+Shift+B** to enter batch mode
2. Modal opens with persistent form
3. User fills in title, dates, category
4. Press Enter to create event (form resets immediately)
5. Shows checklist of created events
6. Can remove events from the list
7. Press Escape or click "Done" to finish

### Implementation Steps
1. Add global keyboard listener for Ctrl+Shift+B
2. Show `BatchInputMode` component (already created)
3. Form persists after saving (doesn't close)
4. Each event appears in green success list
5. Can remove events if made a mistake
6. On close, refreshes calendar with all new events

### Advantages
- ✅ Rapid fire: create multiple events in one flow
- ✅ No modal reopening between events
- ✅ Shows progress/confirmation of what was created
- ✅ Can undo individual events before closing
- ✅ Good for planning sessions (add week's events)

### Challenges
- More form fields (title, start, end, category)
- Users might accidentally create duplicates
- Takes up screen space

### When to Use
- Planning sessions (weekly planning)
- Batch logging multiple events
- Projects with many tasks

### Complexity: Low (component already created)

### Integration Code
```tsx
// In year-grid.tsx or calendar/page.tsx
const [batchModeOpen, setBatchModeOpen] = useState(false);

useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'b') {
            e.preventDefault();
            setBatchModeOpen(!batchModeOpen);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [batchModeOpen]);

return (
    <>
        <YearGrid />
        <BatchInputMode
            isOpen={batchModeOpen}
            onClose={() => setBatchModeOpen(false)}
            onEventCreated={refreshEvents}
        />
    </>
);
```

---

## Comparison Matrix

| Feature | Option 2 | Option 3 | Option 4 |
|---------|----------|----------|----------|
| **Speed** | Very Fast | Fast | Medium |
| **Learning Curve** | Steep | Flat | Flat |
| **Single-day** | ✅ | ✅✅ | ✅ |
| **Date Ranges** | ✅✅ | ❌ | ✅✅ |
| **Keyboard Shortcuts** | ✅✅ | ✅ | ✅ |
| **Visual Feedback** | Medium | High | High |
| **Complexity** | High | Low | Low |
| **Batch Creating** | ✅ | Chaining | ✅✅ |

---

## Recommendation

**For Maximum Productivity, Combine Options 3 + 4:**

1. **Right-click quick menu (Option 3)** - Best for:
   - Quick single-day entries
   - When you're clicking anyway
   - Rapid daily logging

2. **Batch mode (Option 4)** - Best for:
   - Planning sessions (create week's events at once)
   - Project setup (multiple related events)
   - Complex date ranges

**Skip Option 2** unless:
- You have power users who demand CLI-style input
- You have dedicated parsing library already
- Users are very keyboard-focused

---

## Files Created

- `components/calendar/quick-event-menu.tsx` - Right-click menu
- `components/calendar/batch-input-mode.tsx` - Batch mode modal

Both are fully functional and just need to be integrated into the calendar page.
