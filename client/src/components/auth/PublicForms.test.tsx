import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { RoleSelector } from "./RoleSelector";
import type { RegisterableRole } from "@/lib/constants/roles";
import { registerSchema } from "@/lib/validators/authSchemas";
import ContactSupportPage, {
  supportDraft,
} from "@/pages/help/ContactSupportPage";

afterEach(() => vi.unstubAllGlobals());

it("gives unnamed inputs a stable label and associates hints/errors with their field", () => {
  const { rerender } = render(
    <Input
      label="Your name"
      hint="Use your full name"
      aria-describedby="extra-help"
    />,
  );
  const input = screen.getByRole("textbox", { name: "Your name" });
  expect(input.id).toBeTruthy();
  const id = input.id;
  expect(input.getAttribute("aria-describedby")).toBe(
    `extra-help ${id}-message`,
  );
  rerender(
    <Input
      label="Your name"
      error="Name is required"
      aria-describedby="extra-help"
    />,
  );
  expect(input.id).toBe(id);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").id).toBe(`${id}-message`);
});

it("exposes one button label at a time, including a named busy state", () => {
  const { rerender } = render(
    <Button loadingText="Signing in…">Sign in</Button>,
  );
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  rerender(
    <Button isLoading loadingText="Signing in…">
      Sign in
    </Button>,
  );
  expect(
    screen
      .getByRole("button", { name: "Signing in…" })
      .getAttribute("aria-busy"),
  ).toBe("true");
  rerender(<Button isLoading>Sign in</Button>);
  expect(
    screen
      .getByRole("button", { name: "Sign in" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
});

it("makes the password toggle keyboard accessible and keeps the value", () => {
  render(
    <PasswordInput name="password" label="Password" defaultValue="AValue123" />,
  );
  const button = screen.getByRole("button", { name: "Show password" });
  expect(button.tabIndex).toBe(0);
  fireEvent.click(button);
  expect(screen.getByLabelText("Password").getAttribute("type")).toBe("text");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe(
    "AValue123",
  );
  fireEvent.click(button);
  expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
    "password",
  );
});

it("uses a labelled native radio group for self-registration and never offers admin", () => {
  function Form() {
    const [role, setRole] = useState<RegisterableRole>("PLAYER");
    return <RoleSelector value={role} onChange={setRole} />;
  }
  render(<Form />);
  expect(screen.getByRole("group", { name: "I’m joining as a" })).toBeTruthy();
  const radios = screen.getAllByRole("radio") as HTMLInputElement[];
  expect(radios).toHaveLength(3);
  expect(radios[0].checked).toBe(true);
  fireEvent.click(radios[2]);
  expect(radios[2].checked).toBe(true);
  expect(radios[0].checked).toBe(false);
  expect(radios.some((r) => r.value === "ADMIN")).toBe(false);
});

it("validates the registration password against the server's maximum length", () => {
  const values = {
    name: "Cricket Fan",
    email: "fan@example.com",
    password: "A1!" + "a".repeat(125),
    confirmPassword: "A1!" + "a".repeat(125),
    role: "PLAYER",
    terms: true,
  };
  expect(registerSchema.safeParse(values).success).toBe(true);
  const result = registerSchema.safeParse({
    ...values,
    password: values.password + "a",
    confirmPassword: values.confirmPassword + "a",
  });
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues[0].message).toBe(
      "Use no more than 128 characters",
    );
});

describe("honest support contact", () => {
  it("encodes user text in an email draft instead of claiming a ticket was sent", () => {
    const draft = supportDraft(
      " Subject\n& details ",
      "Player #1 & purse?\nLine two",
      "Auction",
    );
    const url = new URL(draft.mailto);
    expect(url.protocol).toBe("mailto:");
    expect(url.searchParams.get("subject")).toBe(
      "[GullyBid · Auction] Subject & details",
    );
    expect(url.searchParams.get("body")).toContain(
      "Player #1 & purse?\nLine two",
    );
    expect(draft.title).not.toContain("\n");
  });
  it("prepares a reviewable draft, focuses it, and copies only on request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "navigator",
      Object.assign(Object.create(navigator), { clipboard: { writeText } }),
    );
    render(
      <MemoryRouter>
        <ContactSupportPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "Auction question" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
      target: { value: "How can I register?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare email draft/ }),
    );
    expect(screen.getByText(/Nothing has been sent yet/)).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Your email draft is ready." }),
    );
    expect(screen.queryByText("Ticket Submitted")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: /Open email app/ }).getAttribute("href"),
    ).toContain("mailto:");
    fireEvent.click(screen.getByRole("button", { name: /Copy draft/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Draft copied" })).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("How can I register?"),
    );
    vi.unstubAllGlobals();
  });
  it("offers manual copying if browser clipboard permission is unavailable", async () => {
    vi.stubGlobal(
      "navigator",
      Object.assign(Object.create(navigator), {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      }),
    );
    render(
      <MemoryRouter>
        <ContactSupportPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), {
      target: { value: "Help" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
      target: { value: "My question" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Prepare email draft/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy draft/ }));
    await waitFor(() =>
      expect(screen.getByText(/Automatic copying is unavailable/)).toBeTruthy(),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Subject & message" }),
    );
    vi.unstubAllGlobals();
  });
});
