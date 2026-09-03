// jest-dom's matchers (toBeInTheDocument, toBeDisabled, toHaveTextContent…).
// The package was already a devDependency but nothing registered it, so the
// matchers were unavailable to any test that wanted them.
import "@testing-library/jest-dom/vitest";
