# Client Implementation Findings

## ToolCallRow and LiveActivity Integration

### Test Data Issues
- The `LiveActivity` tests provided initially lacked `toolCalls` data in the `sessionWithTools` mock objects, causing tests expecting tool call rendering to fail.
- Fixed by adding mock `toolCalls` arrays to the test data.
- The `ToolCallRow` test used a hardcoded date `2024-01-15` which caused relative time formatting tests to fail in `2026`. Fixed by using `new Date().toISOString()`.

### Test ID Collision
- The regex `/^tool-call-row-/` matches both the row container (`tool-call-row-${id}`) AND the expand button (`tool-call-row-expand`).
- This caused `getAllByTestId` to return double the expected number of elements.
- Fixed by making the regex more specific: `/^tool-call-row-tool-/`.

### Component Logic
- Implemented `ToolCallRow` with recursive/JSON formatting for inputs.
- Implemented expandable/collapsible tool list in `LiveActivity`.
- Implemented "Show more" pagination (default 5 items).
