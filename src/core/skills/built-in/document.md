# Document Skill

Generate documentation for code.

## Trigger
- command: /document

## Variables
- file_path: The file to document
- format: Documentation format (jsdoc, tsdoc, markdown)

## Steps
1. Read the target file
   - tool: Read
   - params: { "file_path": "${file_path}" }

2. Generate documentation
   - prompt: Generate ${format} documentation for the code from the previous step. Include:
     - Module/file description
     - Function/method descriptions with parameters and return types
     - Usage examples
     - Type definitions if applicable
     Make the documentation clear and helpful for other developers.

## On Error
- continue
