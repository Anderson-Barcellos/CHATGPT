# Export System Usage Guide

## Overview

The export system provides comprehensive conversation export functionality in multiple formats:
- **Markdown** (.md) - Human-readable format with formatting
- **JSON** (.json) - Machine-readable format for re-importing
- **PDF** (.pdf) - Print-friendly document format
- **Clipboard** - Copy with rich text formatting

## Quick Start

### Using the ExportMenu Component

The easiest way to add export functionality is to use the pre-built `ExportMenu` component:

```tsx
import { ExportMenu } from "@/components/chat/ExportMenu";

function ChatHeader({ conversation }: { conversation: Conversation }) {
  return (
    <div className="flex items-center gap-2">
      <h1>{conversation.title}</h1>
      <ExportMenu conversation={conversation} />
    </div>
  );
}
```

### Keyboard Shortcuts

- `Ctrl/Cmd + Shift + E` - Open export menu
- `Ctrl/Cmd + Shift + M` - Export as Markdown
- `Ctrl/Cmd + Shift + J` - Export as JSON
- `Ctrl/Cmd + Shift + P` - Export as PDF
- `Ctrl/Cmd + Shift + C` - Copy to clipboard

## Advanced Usage

### Using the Hook Directly

```tsx
import { useExport } from "@/hooks/useExport";

function MyComponent({ conversation }: { conversation: Conversation }) {
  const { exportConversation, isExporting, progress } = useExport();

  const handleExport = async () => {
    await exportConversation(conversation, "markdown", {
      includeMetadata: true,
      includeTimestamps: true,
      includeReasoning: true,
      modelParameters: myModelParams,
    });
  };

  return (
    <button onClick={handleExport} disabled={isExporting}>
      {isExporting ? `Exporting ${progress.progress}%` : "Export"}
    </button>
  );
}
```

### Using Export Functions Directly

```tsx
import {
  downloadMarkdown,
  downloadJSON,
  downloadPDF,
  copyToClipboard,
} from "@/lib/export";

// Export as Markdown
await downloadMarkdown(conversation, {
  includeMetadata: true,
  includeTimestamps: true,
  includeReasoning: true,
});

// Export as JSON
await downloadJSON(conversation, {
  includeMetadata: true,
  includeImages: true,
  pretty: true,
});

// Export as PDF
await downloadPDF(conversation, {
  includeMetadata: true,
  includeTimestamps: true,
  includeReasoning: true,
  includeImages: true,
});

// Copy to clipboard
await copyToClipboard(conversation, {
  format: "markdown",
  includeMetadata: true,
});
```

## Export Options

### Markdown Options

```typescript
interface MarkdownExportOptions {
  includeMetadata?: boolean;      // Include conversation metadata (default: true)
  includeTimestamps?: boolean;    // Include message timestamps (default: true)
  includeReasoning?: boolean;     // Include reasoning text (default: true)
  modelParameters?: ModelParameters; // Include model configuration
}
```

### JSON Options

```typescript
interface JSONExportOptions {
  includeMetadata?: boolean;      // Include conversation metadata (default: true)
  includeImages?: boolean;        // Include base64 images (default: true)
  pretty?: boolean;               // Pretty-print JSON (default: true)
}
```

### PDF Options

```typescript
interface PDFExportOptions {
  includeMetadata?: boolean;      // Include conversation metadata (default: true)
  includeTimestamps?: boolean;    // Include message timestamps (default: true)
  includeReasoning?: boolean;     // Include reasoning text (default: true)
  includeImages?: boolean;        // Include images inline (default: true)
  modelParameters?: ModelParameters; // Include model configuration
}
```

### Clipboard Options

```typescript
interface ClipboardExportOptions {
  format?: "markdown" | "plain" | "html"; // Format to copy (default: "markdown")
  includeMetadata?: boolean;      // Include conversation metadata (default: true)
  includeTimestamps?: boolean;    // Include message timestamps (default: true)
  includeReasoning?: boolean;     // Include reasoning text (default: true)
  modelParameters?: ModelParameters; // Include model configuration
}
```

## Import Functionality

The JSON export format supports re-importing conversations:

```typescript
import { parseImport, importFromJSON } from "@/lib/export";

// Parse and validate JSON
const result = parseImport(jsonString);
if (result.valid && result.data) {
  // Convert to Conversation object
  const conversation = importFromJSON(result.data);
  
  // Save to database
  await saveConversation(conversation);
} else {
  console.error("Invalid import:", result.error);
}
```

## Export All Formats

Export a conversation in all formats at once:

```tsx
import { useExport } from "@/hooks/useExport";

function ExportAllButton({ conversation }: { conversation: Conversation }) {
  const { exportAll, isExporting } = useExport();

  return (
    <button onClick={() => exportAll(conversation)}>
      {isExporting ? "Exporting..." : "Export All Formats"}
    </button>
  );
}
```

## Customization

### Custom Export Button

Create a custom export button for a specific format:

```tsx
import { ExportButton } from "@/components/chat/ExportMenu";

<ExportButton 
  conversation={conversation} 
  format="pdf" 
  disabled={false} 
/>
```

### Custom Styling

The ExportMenu accepts standard button props:

```tsx
<ExportMenu
  conversation={conversation}
  variant="outline"
  size="lg"
  disabled={false}
/>
```

## Error Handling

The export system automatically handles errors and shows toast notifications:

```tsx
// Success toast
toast.success("Conversation exported as PDF", {
  description: `"${conversation.title}" has been downloaded`,
});

// Error toast
toast.error("Export failed", {
  description: error.message,
});
```

## File Naming

All exports use sanitized filenames based on the conversation title:
- Special characters are replaced with underscores
- Filenames are limited to 100 characters
- Examples:
  - "My Great Chat!" → `my_great_chat.md`
  - "Chat @ 2025" → `chat_2025.json`

## Integration Example

Complete example of integrating the export menu into a chat interface:

```tsx
import { ExportMenu } from "@/components/chat/ExportMenu";
import { useChatStore } from "@/stores/chatStore";

export function ChatHeader() {
  const { activeConversation } = useChatStore();

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <h1 className="text-xl font-bold">
        {activeConversation?.title || "New Chat"}
      </h1>
      
      <div className="flex items-center gap-2">
        {/* Other buttons */}
        <ExportMenu 
          conversation={activeConversation}
          variant="ghost"
          size="sm"
        />
      </div>
    </header>
  );
}
```

## Notes

- PDF generation may take a few seconds for long conversations
- Large images in PDFs will be scaled to fit the page width
- JSON exports preserve all conversation data including images (as base64)
- Clipboard copies support both plain text and rich HTML formats
- Export format version is included in JSON exports for future compatibility
