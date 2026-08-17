export function formatFileDate(iso: string | undefined): string {
  if (!iso) {
    return "غير متوفر";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "غير متوفر";
  }

  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function createdAtLabel(isBirthtime: boolean, platform: string): string {
  if (isBirthtime) {
    return "تاريخ الإنشاء على القرص";
  }
  if (platform === "linux") {
    return "تاريخ النظام (قد لا يكون وقت الإنشاء الفعلي)";
  }
  return "تاريخ الإنشاء";
}
