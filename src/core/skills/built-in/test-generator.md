# Test Generator Skill

Generate unit tests for existing code.

## Trigger
- command: /test-gen

## Variables
- file_path: The file to generate tests for
- framework: Testing framework (jest, vitest, mocha)

## Steps
1. Read the target file
   - tool: Read
   - params: { "file_path": "${file_path}" }

2. Generate test cases
   - prompt: Generate comprehensive unit tests for the code from the previous step using ${framework}. Include:
     - Test cases for all public functions/methods
     - Edge cases and boundary conditions
     - Error handling tests
     - Mock external dependencies
     Write the test file content.

## On Error
- continue
