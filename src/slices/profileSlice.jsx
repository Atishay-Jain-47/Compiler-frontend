import {createSlice} from "@reduxjs/toolkit"

const initialState = {
    user: localStorage.getItem("user"),
    loading: false,
};

const profileSlice = createSlice({
    name:"profile",
    initialState: initialState,
    reducers: {
        setUser(state, value) {
            state.user = value.payload;
            localStorage.setItem("user", value.payload); // Add this line
        },
        setLoading(state, value) {
            state.loading = value.payload;
        },
    },
});

export const {setUser, setLoading } = profileSlice.actions;
export default profileSlice.reducer;