// Helper function to get initial files based on language
export function getInitialFiles(language: string) {
    const templates = {
        python: {
            'main.py': '# Write your code here\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n'
        },
        java: {
            'Main.java': 'public class Main {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}\n'
        },
        cpp: {
            'main.cpp': '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}\n'
        },
        javascript: {
            'main.js': '// Write your code here\nfunction main() {\n    \n}\n\nmain();\n'
        }
    };

    return (templates as Record<string, Record<string, string>>)[language] || templates.python;
}
