const english = require("./en.json");
let language = "ru";
function setLanguage(next) {
  language = next === "en" ? "en" : "ru";
}
function t(key, ...args) {
  const value = language === "en" ? english[key] || key : key;
  return value.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < args.length ? String(args[Number(index)]) : match,
  );
}
module.exports = { t, setLanguage };
