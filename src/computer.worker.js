import { chooseComputerAction } from "./computer.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ plan: chooseComputerAction(data) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
