import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  language: localStorage.getItem("language") || "PYTHON",
  code: localStorage.getItem(`code_${localStorage.getItem("language")}`) || "",
  input: localStorage.getItem("input") || "",

  output: "",
  loading: false,
  error: null,
};

const codeSlice = createSlice({
  name: "code",
  initialState: initialState,
  reducers: {
    // Change 'value' to 'action' to follow Redux standards
    setLanguage(state, action) {
      state.language = action.payload;
    },
    setCode(state, action) {
      state.code = action.payload;
    },
    setInput(state, action) {
      state.input = action.payload;
    },
    setOutput(state, action) {
      state.output = action.payload;
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
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