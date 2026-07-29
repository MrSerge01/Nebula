/** @warning settingsEmbed.ts (related to database/types.ts)
 * IMPORTANT!
 *
 * This file is not properly typed, and I genuinely do not know how to fix it.
 * This is due to some of the things I wanted to achieve being straight up not supported by the TypeScript compiler.
 *
 * As a result, many variables are either manually casted or straight up `unknown`, `any` or `never`.
 * We've agreed that linter errors on this file specifically do _not_ prevent a PR from being merged,
 * so long as any change to this file has been THOROUGHLY tested.
 *
 * Pay close attention, you'll have to make assumptions or type inference in your brain.
 * Modify this with care and only if things are broken and you're sure that THIS and not any other file
 * is the one you have to change to fix it (or if you're trying to fix the typing system[^1]).
 *
 * Test thrice anything you touch here.
 * Under doubt, distrust anything the compiler (or heck, the typecasts/comments) tell you.
 *
 * [^1]: Good luck.
 */

import { resetSetting, resetSettingCategory, settingsDefinition, type TS } from "database/settings";
import {
  isSettingValueValid,
  type SettingReturnType,
  type SettingDefinitionRecord,
  type SingleSettingDefinition,
  type SettingKeyFor,
  type SettingSettableValue,
} from "database/types";
import {
  ActionRowBuilder,
  type AnySelectMenuInteraction,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  type ModalSubmitInteraction,
  RoleSelectMenuBuilder,
  SectionBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type MessageActionRowComponentBuilder,
  SeparatorBuilder,
  type Guild,
  ModalBuilder,
  codeBlock,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { colorize, Sokolors } from "utils/colorize";
import { dotCheck } from "utils/dotCheck";
import { humanizeSettings, humanizeSettingType } from "utils/humanizeSettings";
import { modalSubmit } from "utils/modalSubmit";
import { handlePages, pagedButtons } from "utils/pagination";
import { safeEdit, safeReply } from "utils/safeThings";
import { setMap } from "utils/setMap";
import { buttonCheck } from "./errorEmbed";

const OBJECTS_PER_ITR_PAGE = 10;

/** Holds the current state of OBJECT view within settingsEmbed for a user. */
interface ObjectState {
  key: keyof TS;
  setting: SettingKeyFor<keyof TS>;
  settingDef: SingleSettingDefinition & { type: "OBJECT" };
  /** `settingState` is always "defined" but sometimes is an empty object. Holds the JS object you'd store in DB, used for data representation. */
  settingState: Record<string, SettingSettableValue>;
  /** `views` is a control string, tells you the type of page to be rendered.
   *
   * `create_or_save` and `default` are obvious. Default shows the standard view (object settings for non iterables, list for iterables), whereas create always shows the same creation UI. View shows it too, but it'll overwrite OBJECT with ID `openSettingGuid` instead of making a new one.
   */
  views: "default" | "create_or_save" | "itr_obj_child";
  /** `openSettingGuid` is the GUID of the selected setting (and OBJECT in an iterator)
   *
   * For context, this will be undefined at launch (and always for non-iterables) and come from a customId prefixed with a plus sign.
   */
  openSettingGuid: string | undefined;
  /** `page` is for paging and only matters when `views == "default"` (and only for iterable objects; otherwise ignore them). Default to zero. */
  page: number;
  /** `pages` is for paging and only matters when `views == "default"` (and only for iterable objects; otherwise ignore them). Default to zero. */
  pages: number;
}

/** Holds the current state of reset view within settingsEmbed for a user. */
interface ResetState {
  /** Whether its running or not. */
  working: boolean;
  /** Keys of settings that will be reset. For `"leveling.enabled"`, this contains `"enabled"`. */
  targets: Set<string>;
}

/**
 * **This is for OBJECT embeds, it tracks their state.** Let's ignore the fact that "state machine" isn't too accurate of a name.
 *
 * Key is USER ID, as in ID of the command runner.
 *
 * Check type `ObjectState`'s JSDoc for what properties mean.
 */
const ObjectStateMachine = new Map<string, ObjectState>();
/**
 * **This is for resetting embeds, it tracks their state.** Let's ignore the fact that "state machine" isn't too accurate of a name.
 *
 * Key is USER ID, as in ID of the command runner.
 *
 * Value is a object with two properties:
 * - `working`: True if the settings embed is in reset mode, false if not. Used to branch out code in the message collector.
 * - `targets`: Set of strings, each string a custom ID tied to the selected item for resetting (e.g., when resetting `leveling.rewards` and `leveling.channels`, this is a `Set["rewards", "channels"]`). Note the cIDs are passed raw (to avoid extra operation), so they actually start with magic string "resettgt_".
 */
const ResetStateMachine = new Map<string, ResetState>();

const OSMSetAndGet = (id: string, state: ObjectState): ObjectState => {
  ObjectStateMachine.set(id, state);
  return state;
};

async function confirmResetModal<K extends keyof TS>(
  interaction: SettingInteraction<K, SettingKeyFor<K>>,
): Promise<ModalSubmitInteraction | false> {
  if (!interaction.isButton() && !interaction.isChatInputCommand()) return false;

  const modal = new ModalBuilder()
    .setCustomId("confirm_resetting")
    .setTitle("•  Are you sure?")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Yes, I want to delete all selected settings!")
        .setCheckboxComponent(checkbox => checkbox.setCustomId("confirm").setDefault(false)),
    );

  await interaction.showModal(modal);
  const modalInteraction = await modalSubmit(interaction);
  if (!modalInteraction) return false;
  if (!modalInteraction.fields.getCheckbox("confirm")) {
    await safeReply({
      interaction: modalInteraction,
      replyOptions: {
        components: [
          await constructModalContainer(
            `**${dotCheck({ string: "✅", twoSides: true, includeString: true })}Nevermind that then**`,
            "No setting was reset. Everything continues to shine the way it did so far.\nIf you *did* expect things to get reset, you probably did not mark the checkbox in the dialog. You're required to toggle it as a double check.",
            Sokolors.Blue,
          ),
        ],
        flags: ["IsComponentsV2", "Ephemeral"],
      },
    });
    return false;
  }
  return modalInteraction;
}

/**
 * Generates an individual row for settings embed. Use it in a loop.
 *
 * @param builder `ContainerBuilder`
 * @param data A tiny control object, check its properties in JSDoc.
 * @param settingObject The `SingleSettingDefinition` for the setting in use
 * @param setting Current setting value
 * @param constructMode Construction mode
 */
function rowGenerator(
  builder: ContainerBuilder,
  data: {
    /** Setting key. For `leveling.enabled`, this is `"enabled"`. */
    key: string;
    /** Setting description. For iterable objects it holds a default string. */
    desc: string;
  },
  settingObject: SingleSettingDefinition,
  setting: unknown,
  constructMode: Mode,
): void {
  const maxValues = settingObject.iterable ? OBJECTS_PER_ITR_PAGE : 1;
  const isNormal = constructMode.mode === "normal";
  const cID = isNormal ? data.key : `resettgt_${data.key}`;

  let component:
    | ButtonBuilder
    | ChannelSelectMenuBuilder
    | RoleSelectMenuBuilder
    | UserSelectMenuBuilder
    | StringSelectMenuBuilder = new ButtonBuilder()
    .setCustomId(cID)
    .setLabel(
      isNormal
        ? (settingObject.type === "OBJECT" && !settingObject.iterable
          ? "Open"
          : "Edit")
        : (constructMode.resetting.has(cID)
          ? "Unselect"
          : "Select"),
    )
    .setStyle(
      isNormal || constructMode.resetting.has(cID) ? ButtonStyle.Secondary : ButtonStyle.Danger,
    );

  if (isNormal)
    switch (settingObject.type) {
      case "BOOL": {
        component = component
          .setLabel(humanizeSettings(setting?.toString() ?? "Not set"))
          .setStyle(setting ? ButtonStyle.Success : ButtonStyle.Danger);

        break;
      }
      case "CHANNEL":
      case "mCHANNEL": {
        component = new ChannelSelectMenuBuilder()
          .setCustomId(cID)
          .setMaxValues(maxValues)
          .setChannelTypes([
            ChannelType.GuildAnnouncement,
            ChannelType.GuildStageVoice,
            ChannelType.GuildText,
            ChannelType.GuildVoice,
          ]);

        if (setting) component.setDefaultChannels(setting as string[]);
        break;
      }
      case "USER":
      case "mUSER": {
        component = new UserSelectMenuBuilder().setCustomId(cID).setMaxValues(maxValues);

        if (setting) component.setDefaultUsers(setting as string[]);
        break;
      }
      case "ROLE":
      case "mROLE": {
        component = new RoleSelectMenuBuilder().setCustomId(cID).setMaxValues(maxValues);

        if (setting) component.setDefaultRoles(setting as string[]);

        break;
      }
      case "SELECT": {
        const options = settingObject.choices ?? [];

        component = new StringSelectMenuBuilder()
          .setCustomId(cID)
          .setMaxValues(options.length)
          .setOptions(
            options.map((option: string) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(option)
                .setValue(option)
                .setDefault((setting as string[]).includes(option)),
            ),
          );

        break;
      }
    }

  const lbl = new TextDisplayBuilder().setContent(
    `${dotCheck({ string: settingObject.emoji, doubleSpace: true, twoSides: true, includeString: true })}${humanizeSettings(data.key)}\n-# ${data.desc}`,
  );

  if (component instanceof ButtonBuilder)
    builder.addSectionComponents(
      new SectionBuilder().addTextDisplayComponents(lbl).setButtonAccessory(component),
    );
  else
    builder
      .addTextDisplayComponents(lbl)
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(component),
      );
}

/**
 * Generates an individual row for settings embed. Use it in a loop. Output (after looping) should be kinda like:
 *
 * object 1 [edit]
 *
 * object 2 [edit]
 *
 * ...
 */
function iterableObjectRowGenerator(
  builder: ContainerBuilder,
  data: {
    guid: string;
    indexInArray: number;
    descriptor: string;
  },
  settingObject: SingleSettingDefinition,
): void {
  builder.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `${dotCheck({ string: settingObject.emoji, doubleSpace: true, twoSides: true, includeString: true })}${data.descriptor}\n-# Entry #${data.indexInArray + 1} | ${data.guid}`,
        ),
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`+${data.guid}`)
          .setLabel("Open")
          .setStyle(ButtonStyle.Secondary),
      ),
  );
}

function objectEntriesGenerator<K extends keyof TS, S extends SettingKeyFor<K>>(
  ctl: ControlObject<K, S>,
  objectValue: ObjectState["settingState"],
  lbl: ContainerBuilder,
): void {
  for (const [singleKey, singleDef] of Object.entries(ctl.def.properties)) {
    if (singleKey === "$") continue;
    rowGenerator(
      lbl,
      {
        key: singleKey,
        desc: singleDef.desc,
      },
      singleDef,
      objectValue?.[singleKey] ?? undefined,
      {
        mode: "normal",
      },
    );
  }
}

async function baseObjectViewPrefixGenerator(
  lbl: ContainerBuilder,
  currentState: ObjectState,
  pgCount?: number,
): Promise<ContainerBuilder> {
  lbl.setAccentColor(await colorize({ hue: Sokolors.Blue }));

  const actionRow = new ActionRowBuilder<ButtonBuilder>();

  if (currentState.views != "create_or_save")
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(EXEMPT_CIDs.OBJECT_GO_BACK)
        .setLabel("Go up")
        .setStyle(ButtonStyle.Secondary),
    );

  if (pgCount && pgCount > 1)
    actionRow.addComponents(pagedButtons(pgCount, currentState.page).components);

  if (actionRow.components.length > 0) {
    lbl.addActionRowComponents(actionRow);
    lbl.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
  }

  return lbl;
}

function baseObjectViewSuffixGenerator<K extends keyof TS, S extends SettingKeyFor<K>>(
  ctl: ControlObject<K, S>,
  lbl: ContainerBuilder,
  currentState: ObjectState,
): ContainerBuilder {
  const actionRow = new ActionRowBuilder<ButtonBuilder>();

  if (ctl.def.iterable) {
    const isDisabled =
      currentState.views === "create_or_save" &&
      !isSettingValueValid([currentState.settingState], ctl.def);
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          currentState.views == "create_or_save" || currentState.views == "itr_obj_child"
            ? EXEMPT_CIDs.OBJECT_SAVE
            : EXEMPT_CIDs.OBJECT_OPEN_CREATE,
        )
        .setLabel(
          currentState.views == "create_or_save" || currentState.views == "itr_obj_child"
            ? (isDisabled
              ? "(Finish editing to save)"
              : "Save")
            : "Create",
        )
        .setStyle(ButtonStyle.Success)
        .setDisabled(isDisabled),
      new ButtonBuilder()
        .setCustomId(
          currentState.views == "create_or_save"
            ? EXEMPT_CIDs.OBJECT_GO_BACK
            : (currentState.views == "itr_obj_child"
              ? EXEMPT_CIDs.OBJECT_DELETE_CHILD
              : EXEMPT_CIDs.OBJECT_CLEAR),
        )
        .setLabel(
          currentState.views == "create_or_save"
            ? "Cancel"
            : (currentState.views == "itr_obj_child"
              ? "Delete"
              : "Clear"),
        )
        .setStyle(ButtonStyle.Danger),
    );
  } else
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(EXEMPT_CIDs.OBJECT_CLEAR)
        .setLabel("Reset")
        .setStyle(ButtonStyle.Danger),
    );

  lbl.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
  lbl.addActionRowComponents(actionRow);
  lbl.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `-# You're ${currentState.views === "default" ? "touching" : (currentState.views === "create_or_save" ? "creating a new object within" : "altering an object within")} **${currentState.key} > ${currentState.setting}** configuration, which is a${ctl.def.iterable ? "n iterable" : " static"} object`,
    ),
  );

  return lbl;
}

/** Builds the base view you get when opening an OBJECT setting. */
async function constructBaseObjectView<K extends keyof TS, S extends SettingKeyFor<K>>(
  ctl: ControlObject<K, S>,
  methods: MethodsObject,
  currentState: ObjectState,
  osmKey: string,
): Promise<ContainerBuilder> {
  const _objectValue = await methods.getSettingPlease(ctl.key, ctl.subKey);

  const lbl = new ContainerBuilder();

  let refreshedState: ObjectState | undefined;

  if (ctl.def.iterable) {
    const objectValue = _objectValue as { $: string; [k: string]: unknown }[];
    if (objectValue && objectValue.length > 0) {
      const paged = objectValue.slice(
        OBJECTS_PER_ITR_PAGE * currentState.page,
        OBJECTS_PER_ITR_PAGE * (currentState.page + 1),
      );
      const pgCount = Math.ceil(objectValue.length / OBJECTS_PER_ITR_PAGE);
      await baseObjectViewPrefixGenerator(lbl, currentState, pgCount);
      for (const [index, entry] of paged.entries())
        iterableObjectRowGenerator(
          lbl,
          {
            indexInArray: index,
            guid: entry.$,
            descriptor: ctl.def.naming(entry),
          },
          ctl.def,
        );
      refreshedState = {
        ...currentState,
        pages: pgCount,
      };
    } else {
      await baseObjectViewPrefixGenerator(lbl, currentState);
      lbl.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          "## Ayay, no objects here!\nThis iterable setting has no objects! You might want to add one or more, use the buttons below for that. If all this talk looks like non-sense to you, care to check `/help settings`.",
        ),
      );
    }
  } else {
    await baseObjectViewPrefixGenerator(lbl, currentState);
    objectEntriesGenerator(ctl, _objectValue, lbl);
  }

  if (refreshedState) ObjectStateMachine.set(osmKey, refreshedState);
  else refreshedState = { ...currentState };

  baseObjectViewSuffixGenerator(ctl, lbl, refreshedState);

  return lbl;
}

const EXEMPT_CIDs = {
  RESET: "reset",
  RESET_ALL: "resetctl_all",
  RESET_PROCEED_W_SELECTED: "resetctl_proceed",
  RESET_CANCEL: "resetctl_abort",
  OBJECT_GO_BACK: "objectctl_up",
  OBJECT_OPEN_CREATE: "objectctl_create",
  OBJECT_SAVE: "objectctl_save",
  OBJECT_CLEAR: "objectctl_reset",
  OBJECT_DELETE_CHILD: "objectctl_del_self",
  PG_LEFT: "left",
  PG_RIGHT: "right",
  PG_CNT: "pagecount",
} as const;
/** Exempt buttons, AKA buttons that do special things. */
type Exempt = (typeof EXEMPT_CIDs)[keyof typeof EXEMPT_CIDs] | `resettgt_${string}`;
type SettingInteraction<K extends keyof TS, S extends SettingKeyFor<K>> = (
  ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction
) & {
  guildId: string;
  guild: Guild;
  customId: K | S | Exempt;
};
type NonExemptInteraction<K extends keyof TS, S extends SettingKeyFor<K>> = SettingInteraction<
  K,
  S
> & { customId: S };

/** Can't properly describe this but let's just say this is important. Used in many places. */
interface ControlObject<
  K extends keyof TS = keyof TS,
  S extends SettingKeyFor<K> | undefined = undefined,
> {
  /** Guild/User ID for setting methods. */
  id: string;
  /** Definition we're working with. */
  def: S extends undefined ? SettingDefinitionRecord : SingleSettingDefinition & { type: "OBJECT" };
  /** Key of the setting table we're working with. */
  key: K;
  /** Key of the setting *itself* (within a table) we're working with; only defined for OBJECTs. */
  subKey: S;
}
function MkControlObject<K extends keyof TS, S extends SettingKeyFor<K>>(
  key: K,
  subKey: S,
  id: string,
): ControlObject<K, S>;
function MkControlObject<K extends keyof TS>(
  key: K,
  subKey: undefined,
  id: string,
): ControlObject<K>;
/**
 * Band-aid function to construct properly typed `ControlObject`s, and also type-check subKeys.
 *
 * We have a rather fun issue with TypeScript inferring types which makes `SettingKeyFor<K>` be `never` in most places, because its hard for TypeScript to infer our rather complex settings system.
 *
 * Yes, it _must_ be fixable and these issues _must_ be a skill issue of mine, but so far this is the best fix I could think of.
 * @param key Setting key.
 * @param subKey Setting subKey, or `undefined` to turn `ControlsAnObjectSetting` false in the `ControlObject` definition.
 * @param id Guild/User ID, as always.
 * @returns A properly typed `ControlObject`.
 */
function MkControlObject<K extends keyof TS, S extends SettingKeyFor<K> | undefined>(
  key: K,
  subKey: S,
  id: string,
): ControlObject<K, S> {
  if (!subKey)
    return {
      id,
      key,
      // @ts-expect-error never happening :(
      subKey,
      // @ts-expect-error shut up you too…
      def: settingsDefinition[key],
    } satisfies ControlObject<K>;

  return {
    id,
    key,
    subKey,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    def: settingsDefinition[key].settings[subKey],
  } satisfies ControlObject<K, S>;
}
interface MethodsObject {
  setSettingPlease: <K extends keyof TS, S extends SettingKeyFor<K>>(
    key: K,
    setting: S,
    value: SettingReturnType<K, S>,
  ) => Promise<void>;
  getSettingPlease: <K extends keyof TS, S extends SettingKeyFor<K>>(
    key: K,
    setting: S,
  ) => Promise<SettingReturnType<K, S>>;
}

/** Modes for the base settings embed. */
type Mode =
  | {
      /** Normal. No extra property. */
      mode: "normal";
    }
  | {
      /** Reset view. */
      mode: "reset";
      /** Custom IDs of items that will be reset. */
      resetting: Set<string>;
    };

/** Handles toggles, i.e., whenever a setting is touched (Edit clicked, Enable/Disable toggled, Dropdown changed...).
 *
 * **Writes to DB** on every interaction, **except** OBJECT interactions in which it launches the OBJECT embed.
 *
 * @param interaction
 * @param ctl
 * @param methods Define this to use the standard handler, leave undefined for the OBJECT one.
 * @returns {Promise<SettingReturnType<K, S>> | void} If handling an OBJECT toggle, value you will want to pass to `setSettingPlease`. Void otherwise.
 */
async function toggleHandler<K extends keyof TS>(
  interaction: SettingInteraction<K, SettingKeyFor<K>>,
  ctl: ControlObject<K>,
  methods?: undefined,
): Promise<SettingReturnType<K, SettingKeyFor<K>>>;
async function toggleHandler<K extends keyof TS>(
  interaction: NonExemptInteraction<K, SettingKeyFor<K>>,
  ctl: ControlObject<K, SettingKeyFor<K>>,
  methods: MethodsObject,
): Promise<void>;
async function toggleHandler<K extends keyof TS>(
  interaction: SettingInteraction<K, SettingKeyFor<K>> | NonExemptInteraction<K, SettingKeyFor<K>>,
  ctl: ControlObject<K> | ControlObject<K, SettingKeyFor<K>>,
  methods?: MethodsObject,
): Promise<void | SettingReturnType<K, SettingKeyFor<K>>> {
  const { def, key } = ctl;

  const setting = (methods
    ? def.settings[interaction.customId]
    : def.properties[interaction.customId]) as unknown as SingleSettingDefinition;
  let value = methods
    ? null
    : {
        ...ObjectStateMachine.get(interaction.user.id)?.settingState,
      };
  const previousValue = methods
    ? await methods.getSettingPlease(key, interaction.customId)
    : value[interaction.customId];

  switch (setting.type) {
    case "BOOL": {
      if (methods)
        await methods.setSettingPlease(key, interaction.customId, previousValue ? false : true);
      else
        value = {
          ...value,
          [interaction.customId]: value[interaction.customId] === true ? false : true,
        };
      break;
    }
    case "INTEGER":
    case "mINTEGER":
    case "TEXT":
    case "mTEXT": {
      const modal = new ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle(`•  ${humanizeSettings(interaction.customId)}`)
        .addLabelComponents(
          new LabelBuilder().setLabel("Value").setTextInputComponent(
            new TextInputBuilder()
              .setCustomId("setting")
              .setPlaceholder("Type in the value")
              .setMaxLength(4000)
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setValue((previousValue as string | number | undefined)?.toString() ?? ""),
          ),
        );

      await (interaction as ButtonInteraction).showModal(modal);
      const modalInteraction = await modalSubmit(interaction as ButtonInteraction);

      if (!modalInteraction) break;

      const newValue = modalInteraction.fields.getTextInputValue("setting");
      const isNewValueValid = isSettingValueValid(newValue, setting);

      if (isNewValueValid)
        if (methods) await methods.setSettingPlease(key, interaction.customId, newValue);
        else
          value = {
            ...value,
            [interaction.customId]:
              setting.type === "INTEGER" || setting.type === "mINTEGER"
                ? Number(newValue)
                : newValue,
          };

      await safeReply({
        interaction: modalInteraction,
        replyOptions: {
          components: [
            await constructModalContainer(
              isNewValueValid
                ? `**${dotCheck({ string: methods ? setting.emoji : "✅", twoSides: true, includeString: true })}${humanizeSettings(interaction.customId)}** got changed`
                : `**${dotCheck({ string: methods ? setting.emoji : "❌", twoSides: true, includeString: true })}${humanizeSettings(interaction.customId)}** couldn't be changed!`,
              isNewValueValid
                ? `The ${newValue.length < 50 ? "value" : "**value**"} has been set ${newValue.length >= 500 ? "successfully." : (newValue.length >= 50 ? `to ${newValue}` : `to **${newValue}**`)}`
                : `Given data is invalid. Ensure it's of the valid type (${humanizeSettingType(setting)}) and try again.${newValue?.length >= 500 ? "" : `\nData entered was:\n${codeBlock(newValue)}`}`,
              isNewValueValid ? Sokolors.Blue : Sokolors.Red,
            ),
          ],
          flags: ["Ephemeral", "IsComponentsV2"],
        },
      });
      break;
    }
    case "CHANNEL":
    case "mCHANNEL":
    case "ROLE":
    case "mROLE":
    case "USER":
    case "mUSER":
    case "SELECT": {
      const valueThatWillBeSet = (interaction as StringSelectMenuInteraction).values;
      if (methods) await methods.setSettingPlease(key, interaction.customId, valueThatWillBeSet);
      else
        value = {
          ...value,
          [interaction.customId]: valueThatWillBeSet,
        };

      break;
    }
    case "OBJECT": {
      if (!methods) return;
      const updatedState = OSMSetAndGet(interaction.user.id, {
        views: "default",
        settingState: setting.iterable ? {} : (previousValue ?? {}),
        key,
        setting: interaction.customId,
        settingDef: setting,
        page: 0,
        openSettingGuid: undefined,
        pages: 0,
      });
      await safeEdit({
        interaction,
        editOptions: {
          components: [
            await constructBaseObjectView(
              MkControlObject(ctl.key, interaction.customId as never, ctl.id),
              methods,
              updatedState,
              interaction.user.id,
            ),
          ],
        },
      });
      return;
    }
    default: {
      console.warn(
        "Unhandled setting type",
        setting.type,
        "for",
        interaction.customId,
        "with",
        setting,
        "and",
        methods ? "methods" : "no methods",
      );
      break;
    }
  }

  if (!methods) return value as SettingReturnType<K, S>;

  if (interaction.isButton() || interaction.isAnySelectMenu())
    await safeEdit({
      interaction,
      editOptions: {
        components: [
          await constructBaseSettingsEmbed(ctl, methods, {
            mode: "normal",
          }),
        ],
      },
    });
}

/** Simple thing, builds a container for displaying text/integer settings, which are edited with a modal. */
async function constructModalContainer(
  settingText: string,
  valueText: string,
  hue: number,
): Promise<ContainerBuilder> {
  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(settingText))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(valueText))
    .setAccentColor(await colorize({ hue }));
}

/**
 * Builds the settings embed.
 * @param ctl
 * @param methods
 * @param mode On what mode to build it.
 * @returns
 */
async function constructBaseSettingsEmbed<K extends keyof TS>(
  ctl: ControlObject<K>,
  methods: MethodsObject,
  mode: Mode,
): Promise<ContainerBuilder> {
  const { def, key } = ctl;
  const lbl = new ContainerBuilder().setAccentColor(await colorize({ hue: Sokolors.Blue }));

  for (const [singleKey, singleDef] of Object.entries(def.settings))
    rowGenerator(
      lbl,
      {
        key: singleKey,
        desc: singleDef.desc,
      },
      singleDef,
      await methods.getSettingPlease(key, singleKey),
      mode,
    );

  lbl.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
  if (mode.mode === "reset")
    lbl.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(EXEMPT_CIDs.RESET_ALL)
          .setLabel("Reset everything")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setDisabled(mode.resetting.size === 0)
          .setCustomId(EXEMPT_CIDs.RESET_PROCEED_W_SELECTED)
          .setLabel(mode.resetting.size > 0 ? "Proceed with selected" : "Select what to reset")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EXEMPT_CIDs.RESET_CANCEL)
          .setLabel("Return to regular view")
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  else
    lbl.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Reset some or all settings")
          .setCustomId(EXEMPT_CIDs.RESET)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setLabel(def.description)
          .setCustomId("whatever")
          .setDisabled(true)
          .setStyle(ButtonStyle.Secondary),
      ),
    );

  return lbl;
}

/**
 * Pain.
 *
 * @param interaction Command interaction
 * @param keyDef Object where `key` is the settings key (`"leveling"` e.g.) and `def` is the definition itself (a `SingleDefinitionRecord`).
 * @param methods Object where you pass the `getSettingPlease` and `setSettingPlease` methods. You're supposed to pass wrappers on the DB functions.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export async function settingsEmbed<K extends keyof TS>(
  interaction: ChatInputCommandInteraction & { guild: Guild },
  key: K,
  methods: MethodsObject,
): Promise<void> {
  type SI = SettingInteraction<K, SettingKeyFor<K>>;

  const ctl = MkControlObject(key, undefined, interaction.guild.id);

  const resetting = (): ResetState => {
    return ResetStateMachine.getOrInsertComputed(interaction.user.id, () => ({
      working: false,
      targets: new Set(),
    }));
  };
  const resetResetting = (): void => {
    ResetStateMachine.set(interaction.user.id, { working: false, targets: new Set() });
  };
  const safelyGetObjectState = (): ObjectState => {
    const currentState = ObjectStateMachine.get(interaction.user.id);
    if (!currentState)
      throw new Error(
        "JS-side problem: how the f*ck did we get 'undefined' when reading ObjectStateMachine for this user (" +
          interaction.user.id +
          ") over a control click? It should already exist by here.",
      );

    return currentState;
  };

  // reset on 1st launch of the command
  resetResetting();
  ObjectStateMachine.delete(interaction.user.id);

  async function fullyResetResetting(replyInteraction: SI): Promise<void> {
    await safeEdit({
      interaction: replyInteraction,
      editOptions: {
        components: [
          await constructBaseSettingsEmbed(ctl, methods, {
            mode: "normal",
          }),
        ],
      },
    });
    resetResetting();
  }

  const reply = await interaction.reply({
    components: [
      await constructBaseSettingsEmbed(ctl, methods, {
        mode: "normal",
      }),
    ],
    flags: ["IsComponentsV2", "Ephemeral"],
  });
  const collector = reply.createMessageComponentCollector({ time: 120_000 });
  collector.on("collect", async (replyInteraction: SI) => {
    collector.resetTimer({
      time: 120_000,
    });
    switch (replyInteraction.customId) {
      /// RESET CTL ///
      case EXEMPT_CIDs.RESET: {
        ResetStateMachine.set(interaction.user.id, { working: true, targets: new Set() });
        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseSettingsEmbed(ctl, methods, {
                mode: "reset",
                resetting: resetting().targets,
              }),
            ],
          },
        });
        break;
      }
      case EXEMPT_CIDs.RESET_CANCEL: {
        await fullyResetResetting(replyInteraction);
        break;
      }
      case EXEMPT_CIDs.RESET_ALL: {
        const confirmInteraction = await confirmResetModal(replyInteraction);
        if (!confirmInteraction) {
          await fullyResetResetting(replyInteraction);
          break;
        }

        await resetSettingCategory(ctl.id, ctl.key);
        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseSettingsEmbed(ctl, methods, {
                mode: "normal",
              }),
            ],
          },
        });
        await safeReply({
          interaction: confirmInteraction,
          replyOptions: {
            components: [
              await constructModalContainer(
                `**${dotCheck({ string: "🗑️", twoSides: true, includeString: true })}Everything got reset**`,
                `All **${ctl.key}** settings were reset to their default values.`,
                Sokolors.Red,
              ),
            ],
            flags: ["IsComponentsV2", "Ephemeral"],
          },
        });
        resetResetting();
        break;
      }
      case EXEMPT_CIDs.RESET_PROCEED_W_SELECTED: {
        const confirmInteraction = await confirmResetModal(replyInteraction);
        if (!confirmInteraction) {
          await fullyResetResetting(replyInteraction);
          break;
        }

        const resettingValue = resetting().targets;
        await Promise.all(
          setMap(resettingValue, async v =>
            resetSetting(ctl.id, ctl.key, v.replace("resettgt_", "")),
          ),
        );
        await safeReply({
          interaction: confirmInteraction,
          replyOptions: {
            components: [
              await constructModalContainer(
                `**${dotCheck({ string: "🗑️", twoSides: true, includeString: true })}The settings got reset**`,
                `The **${setMap(resettingValue, s => humanizeSettings(s.replace("resettgt_", "")), true).join(", ")}** settings were reset to their default values.`,
                Sokolors.Red,
              ),
            ],
            flags: ["IsComponentsV2", "Ephemeral"],
          },
        });
        resetResetting();
        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseSettingsEmbed(ctl, methods, {
                mode: "normal",
              }),
            ],
          },
        });
        break;
      }
      /// OBJECT CTL ///
      /// ("マトリョシカ (Matryoshka)" is a banger, just so you know)
      /// (or Matoryoshka, however its spelled, you'll find it both ways)
      case EXEMPT_CIDs.OBJECT_GO_BACK: {
        const previousState = safelyGetObjectState();

        if (previousState.views === "itr_obj_child") {
          const updatedState = OSMSetAndGet(interaction.user.id, {
            ...previousState,
            views: "default",
            settingState: {},
            openSettingGuid: undefined,
          });

          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: [
                await constructBaseObjectView(
                  MkControlObject(ctl.key, previousState.setting, ctl.id),
                  methods,
                  updatedState,
                  interaction.user.id,
                ),
              ],
            },
          });
        } else {
          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: [
                await constructBaseSettingsEmbed(ctl, methods, {
                  mode: "normal",
                }),
              ],
            },
          });
          ObjectStateMachine.delete(interaction.user.id);
        }
        break;
      }
      case EXEMPT_CIDs.OBJECT_SAVE: {
        const currentObjectState = safelyGetObjectState();

        const finalValue = {
          ...currentObjectState.settingState,
          $: currentObjectState.openSettingGuid,
        };
        const previous =
          (await methods.getSettingPlease(ctl.key, currentObjectState.setting)) ?? [];
        if (!finalValue || !isSettingValueValid([finalValue], currentObjectState.settingDef))
          await safeReply({
            interaction,
            replyOptions: {
              components: [
                await constructModalContainer(
                  `${dotCheck({
                    includeString: true,
                    doubleSpace: true,
                    string: "❌",
                  })}**Something went wrong!**`,
                  "We had some sort of error and don't exactly know which. Care to try again?",
                  Sokolors.Red,
                ),
              ],
              flags: ["Ephemeral", "IsComponentsV2"],
            },
          });
        else {
          const finalThing = (
            finalValue.$
              ? [...previous.filter(v => v.$ != finalValue.$), finalValue]
              : [...previous, { ...finalValue, $: Bun.randomUUIDv7() }]
          ).toSorted(currentObjectState.settingDef.sorting);
          await methods.setSettingPlease(ctl.key, currentObjectState.setting, finalThing);
          await safeReply({
            interaction,
            replyOptions: {
              components: [
                await constructModalContainer(
                  `${dotCheck({
                    doubleSpace: true,
                    includeString: true,
                    string: "✅",
                  })}**Object created successfully!**`,
                  "All settings were stored successfully.",
                  Sokolors.Blue,
                ),
              ],
              flags: ["Ephemeral", "IsComponentsV2"],
            },
          });

          const updatedState = OSMSetAndGet(interaction.user.id, {
            ...currentObjectState,
            views: "default",
            settingState: {},
          });

          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: [
                await constructBaseObjectView(
                  MkControlObject(ctl.key, currentObjectState.setting, ctl.id),
                  methods,
                  updatedState,
                  interaction.user.id,
                ),
              ],
            },
          });
        }
        break;
      }
      case EXEMPT_CIDs.OBJECT_OPEN_CREATE: {
        const currentObjectState = safelyGetObjectState();
        const lbl = new ContainerBuilder();

        const subCtl = MkControlObject(ctl.key, currentObjectState.setting, ctl.id);

        const updatedState = OSMSetAndGet(interaction.user.id, {
          ...currentObjectState,
          views: "create_or_save",
        });

        await baseObjectViewPrefixGenerator(lbl, updatedState);
        objectEntriesGenerator(subCtl, updatedState.settingState, lbl);
        baseObjectViewSuffixGenerator(subCtl, lbl, updatedState);

        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [lbl],
          },
        });
        break;
      }
      case EXEMPT_CIDs.OBJECT_DELETE_CHILD: {
        const currentObjectState = safelyGetObjectState();

        const target = (await methods.getSettingPlease(
          currentObjectState.key,
          currentObjectState.setting,
        )) as unknown[];

        const result = target.filter((v: any) => v.$ != currentObjectState.openSettingGuid);

        await methods.setSettingPlease(currentObjectState.key, currentObjectState.setting, result);

        const updatedState = OSMSetAndGet(interaction.user.id, {
          ...currentObjectState,
          views: "default",
          settingState: {},
        });

        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseObjectView(
                MkControlObject(ctl.key, currentObjectState.setting, ctl.id),
                methods,
                updatedState,
                interaction.user.id,
              ),
            ],
          },
        });

        break;
      }
      case EXEMPT_CIDs.OBJECT_CLEAR: {
        const currentObjectState = safelyGetObjectState();

        await methods.setSettingPlease(currentObjectState.key, currentObjectState.setting, []);

        const updatedState = OSMSetAndGet(interaction.user.id, {
          ...currentObjectState,
          views: "default",
          settingState: {},
        });

        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseObjectView(
                MkControlObject(ctl.key, currentObjectState.setting, ctl.id),
                methods,
                updatedState,
                interaction.user.id,
              ),
            ],
          },
        });

        break;
      }
      case EXEMPT_CIDs.PG_CNT:
      case EXEMPT_CIDs.PG_LEFT:
      case EXEMPT_CIDs.PG_RIGHT: {
        if (await buttonCheck({ i: replyInteraction as ButtonInteraction, interaction, reply }))
          return;

        const currentObjectState = safelyGetObjectState();

        if (currentObjectState.views != "default") return;

        const page = await handlePages({
          i: replyInteraction as ButtonInteraction,
          page: currentObjectState.page,
          pages: currentObjectState.pages,
          collector,
        });

        const updatedState = OSMSetAndGet(interaction.user.id, {
          ...currentObjectState,
          views: "default",
          settingState: {},
          page,
        });

        await safeEdit({
          interaction: replyInteraction,
          editOptions: {
            components: [
              await constructBaseObjectView(
                MkControlObject(ctl.key, currentObjectState.setting, ctl.id),
                methods,
                updatedState,
                interaction.user.id,
              ),
            ],
          },
        });

        break;
      }
      default: {
        const resetState = resetting();
        if (resetState.working) {
          await replyInteraction.deferUpdate();

          const targetsSoFar = new Set(resetState.targets);
          if (targetsSoFar.has(replyInteraction.customId))
            targetsSoFar.delete(replyInteraction.customId);
          else targetsSoFar.add(replyInteraction.customId);
          ResetStateMachine.set(interaction.user.id, { working: true, targets: targetsSoFar });
          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: [
                await constructBaseSettingsEmbed(ctl, methods, {
                  mode: "reset",
                  resetting: resetting().targets,
                }),
              ],
            },
          });
        } else if (ObjectStateMachine.has(interaction.user.id)) {
          const currentObjectState = safelyGetObjectState();
          const subCtl = MkControlObject(ctl.key, currentObjectState.setting, ctl.id);
          const lbl = new ContainerBuilder();
          let updatedState: ObjectState;
          if (replyInteraction.customId.startsWith("+")) {
            const heldSettings = (await methods.getSettingPlease(ctl.key, subCtl.subKey)) as Record<
              string,
              SettingSettableValue
            >[];
            const guid = replyInteraction.customId.replace("+", "");
            const settingToLoad = heldSettings.find(v => v.$ == guid);
            if (!settingToLoad)
              throw new Error(
                `Attempted to load setting with GUID ${guid}, but such setting does not exist!`,
              );

            updatedState = OSMSetAndGet(interaction.user.id, {
              ...currentObjectState,
              views: "itr_obj_child",
              openSettingGuid: guid,
              settingState: settingToLoad,
            });
          } else {
            const res = await toggleHandler(replyInteraction, subCtl);
            updatedState = OSMSetAndGet(interaction.user.id, {
              ...currentObjectState,
              settingState: res,
            });
          }

          await baseObjectViewPrefixGenerator(lbl, updatedState);
          objectEntriesGenerator(subCtl, updatedState.settingState, lbl);
          baseObjectViewSuffixGenerator(subCtl, lbl, updatedState);

          await safeEdit({
            interaction: replyInteraction,
            editOptions: {
              components: [lbl],
            },
          });
        } else await toggleHandler(replyInteraction, ctl, methods);
      }
    }
  });
  collector.on("end", async () => {
    await reply.delete();
    ObjectStateMachine.delete(interaction.user.id);
    ResetStateMachine.delete(interaction.user.id);
  });
}
