# Grist Batch Email Widget

A custom widget for Grist that enables batch email composition with BCC recipients management. This widget allows you to easily compose emails to multiple recipients while maintaining privacy through BCC, with additional features for managing your recipient list.

[🔗 Try it here](https://docs.getgrist.com/6wF1LMEkA2J6/Custom-Widget-Portfolio/p/1)

## Features

- 📧 Compose emails to multiple recipients using BCC
- ✂️ Remove/restore recipients from the mailing list
- ➕ Manually add additional recipients
- 🔄 Real-time recipient count updates
- 👥 Separated lists for table contacts and manually added contacts
- 📝 Full email composition (reply-to, subject, content)
- 📄 Auto-fill subject & content from table column (optional)- Use `[Subject]` at the beginning of your content
- 🌐 Multi-language support - Switch between English and French
- 📨 Opens in your default email client for final review and sending

## Installation

### Option 1: Direct Repository Link (Recommended)
1. Create a new custom URL widget in your Grist document
2. Use this repository URL as the widget source : https://amandinedug.github.io/grist-custom-widgets/batch-emailing/
3. Configure the widget to connect to your table columns

### Option 2: Manual Installation
1. Create a new custom widget in your Grist document using the Custom Widget Builder
2. Copy the HTML content and paste it into the widget
3. Copy the CSS from `style.css` and add it in a `<style> </style>` section in the HTML
4. Copy the JavaScript content and replace the placeholder script section
5. Configure the widget to connect to your table columns

## Setup

**Column Mapping**
- **Email Column** (required): Map your email column in the widget configuration
- **Content Column** (optional): Map a column containing email content to auto-fill the message
- The widget will automatically load emails from the mapped column and split comma-separated emails

## Usage

### 1. Content and Subject Auto-Fill
- **Simple Content**: Just write your email content in the Content Column
- **With Auto Subject**: Start your content with `[Your Subject Here]` followed by your message
  ```
  [Meeting Reminder] Don't forget about our meeting tomorrow at 2 PM.
  ```
- The widget will automatically extract the subject from brackets and fill both fields

### 2. Managing Recipients
- Remove recipients by clicking the × button
- Restore removed recipients from the "Removed Recipients" section
- Add additional recipients manually using the input field
- Multiple emails per cell: Use comma-separated format like `email1@domain.com, email2@domain.com`

### 3. Multi-Language Support
- Click the language flag in the top-right corner to switch between English and French
- Your language preference is automatically saved

### 4. Filtering Recipients
- Apply filters to your table view to filter the recipient list
- The widget will update automatically to reflect the filtered data
- Always verify the recipient count matches your expectations

## Technical Details

The widget uses:
- Grist Plugin API for data interaction
- Native JavaScript for DOM manipulation and i18n
- CSS for GitHub-inspired styling
- `mailto:` protocol for email composition
- localStorage for language preference persistence

## Contributing

Contributions are welcome! Feel free to submit issues and enhancement requests.

Special thanks to **aude**, **astranchet** and **nataliemisasi** for their feedback and improvement suggestions!

## Credits

- Created for the Grist community
- Design inspired by GitHub's UI components
- Built using Grist's Custom Widget Builder

## License

MIT License - feel free to use and modify for your needs.

---

*Built with ❤️ for the Grist community*