import { cn, falslyToUndefined } from "./util";

export function Column(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col", props.className)}>{props.children}</div>;
}

export function Row(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-row", props.className)}>{props.children}</div>;
}

export function LinkButton(props: { label: string; onClick: () => void; className?: string }) {
  return (
    <a onClick={props.onClick} className={cn("hover:underline cursor-pointer select-none", props.className)}>
      {props.label}
    </a>
  );
}

export function Button(props: {
  // format
  label: string;
  use?: "primary" | "secondary";
  isDisabled?: boolean;
  tooltip?: string;
  disabledTooltip?: string;
  onClick?(): void;
  className?: string;
}) {
  let className: string;
  switch (props.use) {
    case "secondary":
      className = "outline-4 outline-black text-black";
      break;
    case "primary":
    default:
      className = "bg-black text-white";
      break;
  }

  return (
    <button
      // format
      onClick={props.onClick}
      className={cn(
        // format
        "border-2 border-black font-bold",
        "rounded-full",
        "pt-1 pb-1.5 px-7",
        "cursor-pointer disabled:cursor-default",
        "hover:scale-105 active:scale-95",
        "disabled:opacity-50 transition-transform disabled:hover:scale-100",
        "scale-100 duration-75",
        "uppercase",
        className,
        props.className
      )}
      disabled={props.isDisabled}
      title={falslyToUndefined(props.tooltip) ?? props.isDisabled ? falslyToUndefined(props.disabledTooltip) : undefined}
    >
      {props.label}
    </button>
  );
}

export function Card(props: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white p-4 rounded-lg shadow-lg", props.className)}>{props.children}</div>;
}
