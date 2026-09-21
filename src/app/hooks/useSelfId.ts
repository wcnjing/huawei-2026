import { createContext, useContext } from "react";

export const SelfIdContext = createContext<string>("");
export const useSelfId = () => useContext(SelfIdContext);
