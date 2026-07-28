import type { Interaction } from "discord.js";
import type { TS } from "./settings";

export type FieldData =
  | "TEXT"
  | "mTEXT"
  | "INTEGER"
  | "mINTEGER"
  | "BOOL"
  | "TIMESTAMP"
  | "mTIMESTAMP"
  | "CHANNEL"
  | "mCHANNEL"
  | "USER"
  | "mUSER"
  | "ROLE"
  | "mROLE"
  | "SELECT"
  | "OBJECT";

export interface TableDefinition {
  name: string;
  definition: Record<string, FieldData>;
}

type Maybe<T> = T | undefined;

// [TODO] mTYPE + iterable produces Maybe<TYPE>[] instead of Maybe<TYPE[]>, which is what it should produce…
export type SqlType<T extends FieldData> = {
  BOOL: boolean;
  INTEGER: number;
  mINTEGER: Maybe<number>;
  TEXT: string;
  mTEXT: Maybe<string>;
  TIMESTAMP: Date;
  mTIMESTAMP: Maybe<Date>;
  CHANNEL: string;
  mCHANNEL: Maybe<string>;
  USER: string;
  mUSER: Maybe<string>;
  ROLE: string;
  mROLE: Maybe<string>;
  SELECT: string;
  OBJECT: string;
}[T];

export type SqlObjectType<T extends Record<string, SingleSettingDefinition>> = {
  [K in keyof T]: T[K] extends {
    type: "OBJECT";
    properties: infer P extends Record<string, SingleSettingDefinition>;
  }
    ? SqlObjectType<P>
    : T[K] extends { iterable: true }
      ? SqlType<T[K]["type"]>[]
      : SqlType<T[K]["type"]>;
};

export type TypeOfDefinition<T extends TableDefinition> = {
  [K in keyof T["definition"]]: SqlType<T["definition"][K]>;
};

export type SettingPrecondition<T extends FieldData> = (
  interaction: Interaction,
  newValue: SqlType<T>,
) => Promise<string | undefined>;

interface SettingBase {
  /** Description of the setting. */
  desc: string;
  /** Default value, `undefined` if unset. */
  val?: SettingSettableValue;
  /** If true, the setting holds an array of values rather than a single one. */
  iterable?: boolean;
  /** Emoji that represents the setting, used in SE. */
  emoji?: string;
}

interface SelectSetting extends SettingBase {
  type: "SELECT";
  /** List of available choices for the select menu. */
  choices: string[];
  precondition?: SettingPrecondition<"SELECT">;
}

interface ObjectBase extends SettingBase {
  type: "OBJECT";
  /** Named properties for the OBJECT setting. */
  properties: Record<string, SingleSettingDefinition>;
  precondition?: SettingPrecondition<"OBJECT">;
}

interface SingleObjectSetting extends ObjectBase {
  iterable?: false | undefined;
}

interface IterableObjectSetting extends ObjectBase {
  iterable: true;
  /** Sorting callback for the OBJECT list. Passed to `Array#toSorted`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sorting: (a: any, b: any) => number;
  /** Naming callback for the OBJECT list. An OBJECT is passed to it and it should return a string representation. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  naming: (a: any) => string;
}

type PrimitiveSetting<K extends Exclude<FieldData, "SELECT" | "OBJECT">> = {
  type: K;
} & SettingBase & {
    precondition?: SettingPrecondition<K>;
  };

export type SingleSettingDefinition =
  | SelectSetting
  | SingleObjectSetting
  | IterableObjectSetting
  | PrimitiveSetting<"TEXT" | "mTEXT" | "INTEGER" | "mINTEGER">
  | PrimitiveSetting<"BOOL">
  | PrimitiveSetting<"TIMESTAMP" | "mTIMESTAMP">
  | PrimitiveSetting<"CHANNEL" | "mCHANNEL">
  | PrimitiveSetting<"USER" | "mUSER">
  | PrimitiveSetting<"ROLE" | "mROLE">;

export interface SettingDefinitionRecord {
  description: string;
  settings: Record<string, SingleSettingDefinition>;
}

export type SettingsDefinition = Record<string, SettingDefinitionRecord>;

export type SettingSettableValueBase = string | string[] | boolean | number | null;
export type SettingSettableValue =
  | SettingSettableValueBase
  | Record<string, SettingSettableValueBase>
  | Record<string, SettingSettableValueBase>[];

type BaseSettingValueFromDef<T> = T extends SingleSettingDefinition
  ? T extends { iterable: true }
    ? (T extends { type: "OBJECT" } ? SqlObjectType<T["properties"]> : SqlType<T["type"]>)[]
    : T extends { type: "OBJECT" }
      ? SqlObjectType<T["properties"]>
      : SqlType<T["type"]>
  : never;

export type SettingValueFromDef<T> = T extends { val: SettingSettableValue }
  ? // can still be undefined if FieldData type is a Maybe type
    BaseSettingValueFromDef<T>
  : // if you use a Maybe this produces undefined | undefined, which doesn't matter
    BaseSettingValueFromDef<T> | undefined;

export type SettingsFor<K extends keyof TS> = TS[K]["settings"];

export type Setting<K extends keyof TS, S extends keyof TS[K]["settings"]> = TS[K]["settings"][S];

/** Filter out anything that isn't an OBJECT setting. */
type ObjectEntries<T extends Record<string, { type: string }>> = {
  [P in keyof T as T[P]["type"] extends "OBJECT" ? P : never]: T[P];
};

export type SettingsObjectsFor<K extends keyof TS> = ObjectEntries<TS[K]["settings"]>;

export type SettingKeyFor<K extends keyof TS> = keyof TS[K]["settings"] & string;

export type SettingReturnType<
  K extends keyof TS,
  S extends keyof SettingsFor<K>,
> = SettingValueFromDef<SettingsFor<K>[S]>;

export type BulkedSettingReturnType<K extends keyof TS> = {
  [S in keyof SettingsFor<K>]: SettingValueFromDef<SettingsFor<K>[S]>;
};

export type SettingMethodSet<K extends keyof TS, S extends keyof SettingsFor<K>> = (
  key: K,
  setting: S,
  value: SettingValueFromDef<TS[K]["settings"][S]>,
) => Promise<void>;

export type SettingMethodGet<K extends keyof TS, S extends keyof SettingsFor<K>> = (
  key: K,
  setting: S,
) => Promise<SettingValueFromDef<TS[K]["settings"][S]>>;

/** Called "glue fix" because after some (tiny to be fair) research I'm starting to think that the Sokora type system goes beyond LANGUAGE LIMITATIONS (LMFAO).
 *
 * For reference: Where I'm using this, WHATEVER I DO, the TypeScript compiler fails to infer the types, even if I make the definition oddly explicit (to the point you'd see that code and call it a "glue fix" anyway). It genuinely needs this type assertion to function properly.
 */
export type SettingsGlueFix1<
  K extends keyof TS,
  S extends keyof SettingsFor<K>,
> = SingleSettingDefinition & { val?: SettingReturnType<K, S> };

/**
 * Validates a value against its setting definition. Does not check preconditions.
 *
 * For objects or iterables, it deeply checks every value.
 *
 * Lacks generic typing (due to how hard it is to make it work...), assert types yourself.
 *
 * Also, when validating iterable settings, it expects an array. If validating a single entry, wrap it in `[]` so it works.
 *
 * @param value Value to validate
 * @param def Definition to validate against.
 * @returns `true` if everything is valid, false otherwise.
 */
export function isSettingValueValid(
  value: unknown,
  def: SingleSettingDefinition,
): value is SettingSettableValue {
  console.debug(def, value, "<<< TypeCheck");

  if (def.iterable) {
    const isArray = Array.isArray(value);
    if (def.type.startsWith("m") && (value === undefined || (isArray && value.length > 0)))
      return true;

    if (!isArray) return false;
    return value.every(v => isSettingValueValid(v, { ...def, iterable: false }));
  }

  switch (def.type) {
    case "OBJECT": {
      if (typeof value !== "object" || value === null) return false;

      const objectValue = value as Record<string, SettingSettableValue>;
      console.debug(objectValue, "<<< OBJ VAL");
      for (const [property, propertyDefinition] of Object.entries(def.properties)) {
        console.debug(property, propertyDefinition, objectValue[property], "A vs B vs C!!");
        if (property == "$") continue;
        if (!Object.hasOwn(objectValue, property) && !propertyDefinition.type.startsWith("m"))
          return false;

        console.debug(objectValue[property], propertyDefinition, "A vs B");
        if (!isSettingValueValid(objectValue[property], propertyDefinition)) return false;
      }
      return true;
    }
    case "BOOL": {
      return typeof value === "boolean";
    }
    case "INTEGER":
    case "mINTEGER": {
      if (value === undefined && def.type === "mINTEGER") return true;
      return (
        typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value)))
      );
    }
    case "mUSER":
    case "USER":
    case "ROLE":
    case "mROLE":
    case "CHANNEL":
    case "mCHANNEL": {
      // can't validate they IDs on its own, use safeThings for that; this just checks format (numeric string)
      if (value === undefined && def.type.startsWith("m")) return true;
      // https://stackoverflow.com/questions/175739/how-can-i-check-if-a-string-is-a-valid-number
      return typeof value === "string";
    }
    case "SELECT": {
      return typeof value === "string" && def.choices.includes(value);
    }
    case "TEXT":
    case "mTEXT": {
      if (def.type === "mTEXT") return typeof value === "string" || value === undefined;
      return typeof value === "string" && value.trim().length > 0;
    }
    case "TIMESTAMP":
    case "mTIMESTAMP": {
      return true; // TODO
    }
    default: {
      // unreachable, exists for the compiler's sake and happinness
      return false;
    }
  }
}
