import type { ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

type RenderResult = {
  container: HTMLDivElement;
  unmount: () => Promise<void>;
};

export async function render(ui: ReactElement): Promise<RenderResult> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(ui);
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}
