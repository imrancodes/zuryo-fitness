const isWholeOrEmpty = (value: number | null | undefined) => value == null || Number.isInteger(value);

export const paise = {
  type: Number,
  required: true,
  min: 0,
  validate: { validator: isWholeOrEmpty, message: "Amount must be whole paise" },
};

export const count = {
  type: Number,
  required: true,
  min: 0,
  validate: { validator: isWholeOrEmpty, message: "Must be a whole number" },
};
