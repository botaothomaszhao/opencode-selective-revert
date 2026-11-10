import { Rpc } from "@opencode/plugin/rpc"

const definition = {
  id: "selective-revert",
  events: {},
  methods: {
    copy: {
      input: {
        type: "object",
        properties: {
          text: { type: "string" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
    apply: {
      input: {
        type: "object",
        properties: {
          directory: { type: "string" },
          reverse: { type: "boolean" },
          patches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                file: { type: "string" },
                patch: { type: "string" },
              },
              required: ["file", "patch"],
              additionalProperties: false,
            },
          },
        },
        required: ["directory", "patches"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          files: { type: "array", items: { type: "string" } },
          message: { type: "string" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
  },
} as const satisfies Rpc.PortableDefinition

export const SelectiveRevert = Rpc.define(definition)
