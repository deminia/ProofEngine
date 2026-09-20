import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "../Dropdown.jsx";

afterEach(() => {
  cleanup();
});

describe("Dropdown component", () => {
  it("opens menu when trigger is clicked and closes on item click", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();

    render(
      <Dropdown
        trigger={<button>⋯ Menu</button>}
        items={[
          { label: "Edit Story", onClick: handleAction },
          { divider: true },
          { label: "Delete", danger: true, onClick: vi.fn() },
        ]}
      />
    );

    // Menu initially closed
    expect(screen.queryByText("Edit Story")).toBeNull();

    // Click trigger
    await user.click(screen.getByRole("button", { name: "⋯ Menu" }));
    expect(screen.getByText("Edit Story")).toBeInTheDocument();

    // Click item
    await user.click(screen.getByText("Edit Story"));
    expect(handleAction).toHaveBeenCalledTimes(1);

    // Menu closes after click
    expect(screen.queryByText("Edit Story")).toBeNull();
  });

  it("closes when pressing Escape", async () => {
    const user = userEvent.setup();

    render(
      <Dropdown
        trigger={<button>Trigger</button>}
        items={[{ label: "Action 1", onClick: vi.fn() }]}
      />
    );

    await user.click(screen.getByRole("button", { name: "Trigger" }));
    expect(screen.getByText("Action 1")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Action 1")).toBeNull();
  });
});
