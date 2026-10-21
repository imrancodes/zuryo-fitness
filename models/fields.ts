export const paise = {
  type: Number,
  required: true,
  min: 0,
  validate: { validator: Number.isInteger, message: "Amount must be whole paise" },
};

export const count = {
  type: Number,
  required: true,
  min: 0,
  validate: { validator: Number.isInteger, message: "Must be a whole number" },
};
