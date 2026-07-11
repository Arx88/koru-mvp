import type { Visualizer } from "../types";

export const GenericListVisualizer: Visualizer = {
  id: "generic_list",
  render() {
    return {
      type: "data_card",
      title: "Resultado",
      items: [],
    };
  },
};
