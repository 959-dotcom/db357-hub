import type { Permissions } from "@/lib/types";

export const APP_CATALOG = [
  {
    key: "land",
    permission: "can_access_land",
    name: "Land Desk",
    subtitle: "Pawn & mortgage",
    description: "Collateral files, valuations, and mortgage instruments.",
    href: "https://168.db357.com",
  },
  {
    key: "dmck",
    permission: "can_access_dmck",
    name: "DM-CK",
    subtitle: "Domain checker",
    description: "Registry lookups and availability for the house book.",
    href: "https://spinlytics-db357.vercel.app",
  },
  {
    key: "coupon",
    permission: "can_access_coupon",
    name: "Coupon Desk",
    subtitle: "Agent network",
    description: "Issuance, redemption, and agent settlement.",
    href: "https://app.db357.com",
  },
  {
    key: "loan",
    permission: "can_access_loan",
    name: "Loan Book",
    subtitle: "Personal credit",
    description: "Origination, servicing, and the repayment ledger.",
    href: "https://loan.db357.com",
  },
  {
    key: "aircon",
    permission: "can_access_aircon",
    name: "Air Atelier",
    subtitle: "Car aircon",
    description: "Service orders for cabin climate systems.",
    href: "https://air.db357.com",
  },
] as const;

export type AppKey = (typeof APP_CATALOG)[number]["key"];
export type AppPermission = (typeof APP_CATALOG)[number]["permission"];

export function isAppKey(value: string): value is AppKey {
  return APP_CATALOG.some((app) => app.key === value);
}

export function appByPermission(permission: AppPermission) {
  return APP_CATALOG.find((app) => app.permission === permission)!;
}

export function appsFor(permissions: Permissions) {
  return APP_CATALOG.filter((app) => permissions[app.permission]);
}
