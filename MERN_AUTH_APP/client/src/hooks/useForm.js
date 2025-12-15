import { useState } from "react";

export default function useForm(initial = {}) {
  const [values, setValues] = useState(initial);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const reset = () => setValues(initial);

  return { values, setValues, handleChange, reset };
}
