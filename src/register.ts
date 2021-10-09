import { ErrHunter } from "./errHunter";

export const register = () => {
  Error.stackTraceLimit = Infinity;

  // @ts-ignore
  Error.prototype.getErrorTrace = async function () {
    const errHunter = new ErrHunter(this);
    return await errHunter.getErrorTrace();
  };
};
