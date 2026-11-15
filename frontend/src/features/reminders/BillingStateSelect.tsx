import type { ComponentProps } from "react";
import { Select } from "@/components/ui/select";
const codes =
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  );
export function BillingStateSelect(props: ComponentProps<typeof Select>) {
  return (
    <Select {...props}>
      <option value="">Not set — Pacific fallback</option>
      {codes.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </Select>
  );
}
