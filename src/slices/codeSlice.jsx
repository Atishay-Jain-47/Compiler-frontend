import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  language: localStorage.getItem("language") || "PYTHON",
  code: localStorage.getItem("code") || "print('Hello World')",
  input: localStorage.getItem("input") || "",
  output: "",
  loading: false,
  error: null,
};

const codeSlice = createSlice({
  name: "code",
  initialState: initialState,
  reducers: {
    setLanguage(state, value) {
      state.language = value.payload;
    },
    setCode(state, value) {
      state.code = value.payload;
    },
    setInput(state, value) {
      state.input = value.payload;
    },
    setOutput(state, value) {
      state.output = value.payload;
    },
    setLoading(state, value) {
      state.loading = value.payload;
    },
    setError(state, value) {
      state.error = value.payload;
    },
  },
});

export const {
  setLanguage,
  setCode,
  setInput,
  setOutput,
  setLoading,
  setError,
} = codeSlice.actions;

export default codeSlice.reducer;
