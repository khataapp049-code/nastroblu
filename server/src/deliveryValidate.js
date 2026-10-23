/** Shared delivery / address rules for orders and customer profile. */

function digits(s) {
  return String(s == null ? "" : s).replace(/\D/g, "");
}

/** We deliver all over India: any well-formed 6-digit PIN is acceptable here.
 *  Whether the PIN matches the city/state is checked in pincodeLookup.js. */
function isServiceablePincode(pin) {
  return /^[1-9]\d{5}$/.test(digits(pin));
}

function validateName(raw) {
  const name = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) return { error: "Name is required" };
  if (name.length < 3 || name.length > 60) {
    return { error: "Name must be between 3 and 60 characters" };
  }
  return { value: name };
}

function validatePhone(raw) {
  let d = digits(raw);
  if (d.length === 12 && d.indexOf("91") === 0) d = d.slice(2);
  if (d.length === 11 && d.charAt(0) === "0") d = d.slice(1);
  if (!/^[6-9]\d{9}$/.test(d) || /^(\d)\1{9}$/.test(d)) {
    return { error: "Enter a valid 10-digit mobile number" };
  }
  return { value: d };
}

function validatePincode(raw) {
  const p = digits(raw);
  if (!/^[1-9]\d{5}$/.test(p)) {
    return { error: "Enter a valid 6-digit PIN code" };
  }
  return { value: p };
}

function validateLine(raw, label, min) {
  const v = String(raw || "").trim();
  if (!v) return { error: label + " is required" };
  if (min && v.length < min) return { error: label + " is too short" };
  if (v.length > 120) return { error: label + " is too long" };
  return { value: v };
}

function validateShipping(body) {
  const ship = body && body.shippingAddress && typeof body.shippingAddress === "object" ? body.shippingAddress : null;
  if (!ship) {
    return { error: "Delivery details are required", fields: { form: "Delivery details are required" } };
  }
  const fields = {};
  const name = validateName(body.deliveryName || ship.name || ship.recipientName);
  if (name.error) fields.name = name.error;
  const phone = validatePhone(body.deliveryPhone || ship.phone || ship.recipientPhone);
  if (phone.error) fields.phone = phone.error;
  const line1 = validateLine(ship.line1, "Address line 1", 5);
  if (line1.error) fields.line1 = line1.error;
  const line2 = String(ship.line2 || "").trim();
  if (line2.length > 120) fields.line2 = "Address line 2 is too long";
  const city = validateLine(ship.city, "City", 2);
  if (city.error) fields.city = city.error;
  const state = validateLine(ship.state, "State", 2);
  if (state.error) fields.state = state.error;
  const pin = validatePincode(ship.pincode);
  if (pin.error) fields.pincode = pin.error;

  const keys = Object.keys(fields);
  if (keys.length) {
    return { error: fields[keys[0]], fields };
  }

  return {
    value: {
      name: name.value,
      phone: phone.value,
      line1: line1.value,
      line2: line2,
      city: city.value,
      state: state.value,
      pincode: pin.value,
    },
  };
}

module.exports = {
  isServiceablePincode,
  validateName,
  validatePhone,
  validatePincode,
  validateShipping,
};