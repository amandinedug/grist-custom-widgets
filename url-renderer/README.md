# URL Renderer Widget for Grist

A clean, simple widget for Grist that displays URLs in an embedded iframe. Perfect for viewing web content, documents, or any URL-based resources directly within your Grist interface.

[🔗 Try it here](https://docs.getgrist.com/6wF1LMEkA2J6/Custom-Widget-Portfolio/p/3)

## Features

- 🌐 Display any URL in an embedded iframe
- 🔄 Automatic URL validation
- ⚠️ GitHub-style error messages
- 📱 Responsive design that adapts to widget size
- 🚀 Lightweight and fast loading

## Installation

### Option 1: Direct Repository Link (Recommended)

1. Create a new custom URL widget in your Grist document
2. Use this repository URL as the widget source: `https://amandinedug.github.io/grist-custom-widgets/url-renderer/`

3. Configure the widget to connect to your URL column

### Option 2: Manual Installation

1. Create a new custom widget in your Grist document using the Custom Widget Builder
2. Copy the HTML content and paste it into the widget
3. Configure the widget to connect to your URL column

## Setup

**Column Mapping**

- **URL Column** (required): Map your URL column in the widget configuration
- The widget will automatically display the URL from the selected row

## Usage

### Supported URL Formats

- `https://example.com`
- `http://example.com`
- `https://docs.google.com/document/...`
- `https://www.youtube.com/watch?v=...`
- Any valid URL that can be embedded in an iframe

### Table Setup

Simply create a column in your Grist table containing URLs:

| Name | URL |
|------|-----|
| Google | <https://www.google.com> |
| Documentation | <https://support.getgrist.com> |
| GitHub | <https://github.com> |

### Error Handling

The widget displays clear error messages for:

- Empty cells or missing configuration
- Invalid URL formats
- URLs that cannot be loaded (due to security restrictions)

## Technical Details

The widget uses:

- Grist Plugin API for data interaction
- Native JavaScript for URL validation
- HTML5 iframe for content display

## Limitations

⚠️ **iframe Restrictions**: Some websites prevent embedding in iframes for security reasons (X-Frame-Options). This is normal behavior and not a widget limitation.

## Contributing

Contributions are welcome! Feel free to submit issues and enhancement requests.

## Credits

- Created for the Grist community

## License

MIT License - feel free to use and modify for your needs.

---
