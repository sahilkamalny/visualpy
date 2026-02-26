// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        rules: {
            // Style
            "@typescript-eslint/naming-convention": [
                "warn",
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                },
            ],
            curly: "warn",
            eqeqeq: "warn",
            "no-throw-literal": "warn",
            semi: "warn",

            // Downgrade to warnings — common patterns in VSCode extension code
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    // Prefixing a param with _ is a common convention for intentionally unused params
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            // Allow @ts-ignore (common in VSCode extension interop)
            "@typescript-eslint/ban-ts-comment": "warn",
        },
    },
    {
        // Test files use require() — that's fine for the VSCode test runner pattern
        files: ["src/test/**/*.ts"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
    {
        ignores: ["dist/**", "out/**", "webview/**"],
    }
);
