import { describe, it, expect } from "vitest";
import {
  resolveTransformers,
  transformInput,
  transformOutput,
  transformInputParams,
  transformOutputRows,
  type TypeTransformerOptions,
} from "../src";

describe("type transformers", () => {
  describe("resolveTransformers", () => {
    it("enables transformations for unsupported types", () => {
      const capabilities = {
        supportsBooleans: false,
        supportsDates: false,
        supportsJSON: false,
        supportsArrays: false,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
      const result = resolveTransformers(capabilities);
      expect(result).toEqual({
        booleans: true,
        dates: true,
        json: true,
        disabled: false,
      });
    });

    it("disables transformations for supported types", () => {
      const capabilities = {
        supportsBooleans: true,
        supportsDates: true,
        supportsJSON: true,
        supportsArrays: true,
        supportsUUIDs: true,
        supportsTransactions: true,
        supportsBatch: true,
      };
      const result = resolveTransformers(capabilities);
      expect(result).toEqual({
        booleans: false,
        dates: false,
        json: false,
        disabled: false,
      });
    });

    it("respects explicit options override", () => {
      const capabilities = {
        supportsBooleans: false,
        supportsDates: false,
        supportsJSON: false,
        supportsArrays: false,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
      const result = resolveTransformers(capabilities, {
        booleans: false,
        dates: false,
      });
      expect(result).toEqual({
        booleans: false,
        dates: false,
        json: true,
        disabled: false,
      });
    });

    it("disables all when disabled option is true", () => {
      const capabilities = {
        supportsBooleans: false,
        supportsDates: false,
        supportsJSON: false,
        supportsArrays: false,
        supportsUUIDs: false,
        supportsTransactions: true,
        supportsBatch: true,
      };
      const result = resolveTransformers(capabilities, { disabled: true });
      expect(result).toEqual({
        booleans: false,
        dates: false,
        json: false,
        disabled: true,
      });
    });
  });

  describe("transformInput", () => {
    const enabledTransformers: Required<TypeTransformerOptions> = {
      booleans: true,
      dates: true,
      json: true,
      disabled: false,
    };
    const disabledTransformers: Required<TypeTransformerOptions> = {
      booleans: false,
      dates: false,
      json: false,
      disabled: true,
    };

    describe("booleans → integers", () => {
      it("transforms true to 1", () => {
        expect(transformInput(true, enabledTransformers)).toBe(1);
      });

      it("transforms false to 0", () => {
        expect(transformInput(false, enabledTransformers)).toBe(0);
      });

      it("skips when booleans transform disabled", () => {
        expect(
          transformInput(true, { ...enabledTransformers, booleans: false }),
        ).toBe(true);
      });
    });

    describe("dates → ISO strings", () => {
      it("transforms Date to ISO string", () => {
        const date = new Date("2024-01-15T12:30:00.000Z");
        expect(transformInput(date, enabledTransformers)).toBe(
          "2024-01-15T12:30:00.000Z",
        );
      });

      it("skips when dates transform disabled", () => {
        const date = new Date("2024-01-15T12:30:00.000Z");
        expect(
          transformInput(date, { ...enabledTransformers, dates: false }),
        ).toBe(date);
      });
    });

    describe("JSON → text", () => {
      it("transforms object to JSON string", () => {
        const obj = { foo: "bar", num: 42 };
        expect(transformInput(obj, enabledTransformers)).toBe(
          '{"foo":"bar","num":42}',
        );
      });

      it("transforms array to JSON string", () => {
        const arr = [1, 2, "three"];
        expect(transformInput(arr, enabledTransformers)).toBe('[1,2,"three"]');
      });

      it("skips Date objects (handled by dates transformer)", () => {
        const date = new Date("2024-01-15T12:30:00.000Z");
        const result = transformInput(date, {
          ...enabledTransformers,
          dates: false,
          json: true,
        });
        expect(result).toBe(date);
      });

      it("skips when json transform disabled", () => {
        const obj = { foo: "bar" };
        expect(
          transformInput(obj, { ...enabledTransformers, json: false }),
        ).toBe(obj);
      });
    });

    describe("passthrough", () => {
      it("passes null through", () => {
        expect(transformInput(null, enabledTransformers)).toBeNull();
      });

      it("passes undefined through", () => {
        expect(transformInput(undefined, enabledTransformers)).toBeUndefined();
      });

      it("passes strings through", () => {
        expect(transformInput("hello", enabledTransformers)).toBe("hello");
      });

      it("passes numbers through", () => {
        expect(transformInput(42, enabledTransformers)).toBe(42);
      });
    });
  });

  describe("transformOutput", () => {
    const enabledTransformers: Required<TypeTransformerOptions> = {
      booleans: true,
      dates: true,
      json: true,
      disabled: false,
    };

    describe("ISO strings → dates", () => {
      it("transforms ISO string with time to Date", () => {
        const result = transformOutput(
          "2024-01-15T12:30:00.000Z",
          enabledTransformers,
        );
        expect(result).toBeInstanceOf(Date);
        expect((result as Date).toISOString()).toBe("2024-01-15T12:30:00.000Z");
      });

      it("transforms ISO string date-only to Date", () => {
        const result = transformOutput("2024-01-15", enabledTransformers);
        expect(result).toBeInstanceOf(Date);
      });

      it("does not transform non-ISO date strings", () => {
        expect(transformOutput("January 15, 2024", enabledTransformers)).toBe(
          "January 15, 2024",
        );
        expect(transformOutput("15/01/2024", enabledTransformers)).toBe(
          "15/01/2024",
        );
      });

      it("skips when dates transform disabled", () => {
        const result = transformOutput("2024-01-15T12:30:00.000Z", {
          ...enabledTransformers,
          dates: false,
        });
        expect(result).toBe("2024-01-15T12:30:00.000Z");
      });
    });

    describe("JSON text → objects", () => {
      it("transforms JSON object string to object", () => {
        const result = transformOutput(
          '{"foo":"bar","num":42}',
          enabledTransformers,
        );
        expect(result).toEqual({ foo: "bar", num: 42 });
      });

      it("transforms JSON array string to array", () => {
        const result = transformOutput('[1,2,"three"]', enabledTransformers);
        expect(result).toEqual([1, 2, "three"]);
      });

      it("does not transform non-JSON strings", () => {
        expect(transformOutput("hello world", enabledTransformers)).toBe(
          "hello world",
        );
        expect(transformOutput("{not valid json}", enabledTransformers)).toBe(
          "{not valid json}",
        );
      });

      it("skips when json transform disabled", () => {
        const result = transformOutput('{"foo":"bar"}', {
          ...enabledTransformers,
          json: false,
        });
        expect(result).toBe('{"foo":"bar"}');
      });
    });

    describe("passthrough", () => {
      it("passes null through", () => {
        expect(transformOutput(null, enabledTransformers)).toBeNull();
      });

      it("passes undefined through", () => {
        expect(transformOutput(undefined, enabledTransformers)).toBeUndefined();
      });

      it("passes numbers through", () => {
        expect(transformOutput(42, enabledTransformers)).toBe(42);
      });

      it("passes regular strings through", () => {
        expect(transformOutput("hello", enabledTransformers)).toBe("hello");
      });
    });
  });

  describe("transformInputParams", () => {
    const enabledTransformers: Required<TypeTransformerOptions> = {
      booleans: true,
      dates: true,
      json: true,
      disabled: false,
    };

    it("transforms array of mixed values", () => {
      const date = new Date("2024-01-15T12:30:00.000Z");
      const params = [true, false, date, { foo: "bar" }, "text", 42, null];
      const result = transformInputParams(params, enabledTransformers);
      expect(result).toEqual([
        1,
        0,
        "2024-01-15T12:30:00.000Z",
        '{"foo":"bar"}',
        "text",
        42,
        null,
      ]);
    });

    it("returns original array when disabled", () => {
      const params = [true, new Date()];
      const disabledTransformers: Required<TypeTransformerOptions> = {
        booleans: false,
        dates: false,
        json: false,
        disabled: true,
      };
      const result = transformInputParams(params, disabledTransformers);
      expect(result).toBe(params);
    });
  });

  describe("transformOutputRows", () => {
    const enabledTransformers: Required<TypeTransformerOptions> = {
      booleans: true,
      dates: true,
      json: true,
      disabled: false,
    };

    it("transforms array of rows", () => {
      const rows = [
        { id: 1, created: "2024-01-15T12:30:00.000Z", data: '{"foo":"bar"}' },
        { id: 2, created: "2024-02-20T09:00:00.000Z", data: '["a","b"]' },
      ];
      const result = transformOutputRows(rows, enabledTransformers);
      expect(result[0].created).toBeInstanceOf(Date);
      expect(result[0].data).toEqual({ foo: "bar" });
      expect(result[1].created).toBeInstanceOf(Date);
      expect(result[1].data).toEqual(["a", "b"]);
    });

    it("returns original array when disabled", () => {
      const rows = [{ id: 1, created: "2024-01-15T12:30:00.000Z" }];
      const disabledTransformers: Required<TypeTransformerOptions> = {
        booleans: false,
        dates: false,
        json: false,
        disabled: true,
      };
      const result = transformOutputRows(rows, disabledTransformers);
      expect(result).toBe(rows);
    });

    it("handles empty array", () => {
      expect(transformOutputRows([], enabledTransformers)).toEqual([]);
    });
  });
});

describe("type transformers: edge cases", () => {
  const enabledTransformers: Required<TypeTransformerOptions> = {
    booleans: true,
    dates: true,
    json: true,
    disabled: false,
  };

  describe("date edge cases", () => {
    it("handles ISO date without time", () => {
      const result = transformOutput("2024-01-15", enabledTransformers);
      expect(result).toBeInstanceOf(Date);
    });

    it("handles ISO date with milliseconds", () => {
      const result = transformOutput(
        "2024-01-15T12:30:00.123Z",
        enabledTransformers,
      );
      expect(result).toBeInstanceOf(Date);
      expect((result as Date).getMilliseconds()).toBe(123);
    });

    it("does not transform partial ISO-like strings", () => {
      expect(transformOutput("2024-01", enabledTransformers)).toBe("2024-01");
      expect(transformOutput("2024", enabledTransformers)).toBe("2024");
      expect(transformOutput("2024-01-15T", enabledTransformers)).toBe(
        "2024-01-15T",
      );
    });

    it("does not transform invalid dates that look like ISO", () => {
      expect(transformOutput("2024-13-45", enabledTransformers)).toBe(
        "2024-13-45",
      );
      expect(transformOutput("2024-00-00", enabledTransformers)).toBe(
        "2024-00-00",
      );
    });

    it("handles Date input with timezone", () => {
      const date = new Date("2024-01-15T12:30:00+05:00");
      const result = transformInput(date, enabledTransformers);
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe("JSON edge cases", () => {
    it("handles deeply nested objects", () => {
      const deep = { a: { b: { c: { d: { e: "deep" } } } } };
      const serialized = transformInput(deep, enabledTransformers);
      expect(serialized).toBe('{"a":{"b":{"c":{"d":{"e":"deep"}}}}}');
      const deserialized = transformOutput(
        serialized as string,
        enabledTransformers,
      );
      expect(deserialized).toEqual(deep);
    });

    it("handles arrays with mixed types", () => {
      const arr = [1, "two", null, true, { nested: true }];
      const serialized = transformInput(arr, enabledTransformers);
      expect(typeof serialized).toBe("string");
      const deserialized = transformOutput(
        serialized as string,
        enabledTransformers,
      );
      expect(deserialized).toEqual(arr);
    });

    it("handles empty object", () => {
      const serialized = transformInput({}, enabledTransformers);
      expect(serialized).toBe("{}");
      const deserialized = transformOutput("{}", enabledTransformers);
      expect(deserialized).toEqual({});
    });

    it("handles empty array", () => {
      const serialized = transformInput([], enabledTransformers);
      expect(serialized).toBe("[]");
      const deserialized = transformOutput("[]", enabledTransformers);
      expect(deserialized).toEqual([]);
    });

    it("does not transform strings that look like JSON but are invalid", () => {
      expect(transformOutput("{invalid}", enabledTransformers)).toBe(
        "{invalid}",
      );
      expect(transformOutput("[1,2,", enabledTransformers)).toBe("[1,2,");
      expect(transformOutput('{"key":}', enabledTransformers)).toBe('{"key":}');
    });

    it("does not transform JSON primitive strings", () => {
      expect(transformOutput('"string"', enabledTransformers)).toBe('"string"');
      expect(transformOutput("123", enabledTransformers)).toBe("123");
      expect(transformOutput("true", enabledTransformers)).toBe("true");
    });

    it("handles object with special characters in keys", () => {
      const obj = {
        "key-with-dash": 1,
        "key.with.dot": 2,
        "key with space": 3,
      };
      const serialized = transformInput(obj, enabledTransformers);
      expect(typeof serialized).toBe("string");
      const deserialized = transformOutput(
        serialized as string,
        enabledTransformers,
      );
      expect(deserialized).toEqual(obj);
    });

    it("handles unicode in JSON", () => {
      const obj = { greeting: "こんにちは", emoji: "🎉" };
      const serialized = transformInput(obj, enabledTransformers);
      const deserialized = transformOutput(
        serialized as string,
        enabledTransformers,
      );
      expect(deserialized).toEqual(obj);
    });
  });

  describe("boolean edge cases", () => {
    it("transforms boolean in array", () => {
      const params = [true, false, true];
      const result = transformInputParams(params, enabledTransformers);
      expect(result).toEqual([1, 0, 1]);
    });

    it("does not confuse 0/1 with boolean when transforming output", () => {
      expect(transformOutput(0, enabledTransformers)).toBe(0);
      expect(transformOutput(1, enabledTransformers)).toBe(1);
    });
  });

  describe("mixed transformations", () => {
    it("handles object with date values", () => {
      const date = new Date("2024-01-15T12:30:00.000Z");
      const obj = { created: date, name: "test" };
      const serialized = transformInput(obj, enabledTransformers);
      expect(typeof serialized).toBe("string");
      const parsed = JSON.parse(serialized as string);
      expect(parsed.created).toBe("2024-01-15T12:30:00.000Z");
      expect(parsed.name).toBe("test");
    });

    it("handles complex row transformation", () => {
      const rows = [
        {
          id: 1,
          active: 1,
          created: "2024-01-15T12:30:00.000Z",
          metadata: '{"tags":["a","b"]}',
          name: "test",
        },
      ];
      const result = transformOutputRows(rows, enabledTransformers);
      expect(result[0].id).toBe(1);
      expect(result[0].active).toBe(1); // integers not converted to bool
      expect(result[0].created).toBeInstanceOf(Date);
      expect(result[0].metadata).toEqual({ tags: ["a", "b"] });
      expect(result[0].name).toBe("test");
    });
  });

  describe("selective transformers", () => {
    it("only transforms booleans when enabled", () => {
      const transformers = {
        booleans: true,
        dates: false,
        json: false,
        disabled: false,
      };
      const date = new Date("2024-01-15");
      const obj = { foo: "bar" };

      expect(transformInput(true, transformers)).toBe(1);
      expect(transformInput(date, transformers)).toBe(date);
      expect(transformInput(obj, transformers)).toBe(obj);
    });

    it("only transforms dates when enabled", () => {
      const transformers = {
        booleans: false,
        dates: true,
        json: false,
        disabled: false,
      };
      const date = new Date("2024-01-15T12:30:00.000Z");
      const obj = { foo: "bar" };

      expect(transformInput(true, transformers)).toBe(true);
      expect(transformInput(date, transformers)).toBe(
        "2024-01-15T12:30:00.000Z",
      );
      expect(transformInput(obj, transformers)).toBe(obj);
    });

    it("only transforms json when enabled", () => {
      const transformers = {
        booleans: false,
        dates: false,
        json: true,
        disabled: false,
      };
      const date = new Date("2024-01-15");
      const obj = { foo: "bar" };

      expect(transformInput(true, transformers)).toBe(true);
      expect(transformInput(date, transformers)).toBe(date);
      expect(transformInput(obj, transformers)).toBe('{"foo":"bar"}');
    });
  });

  describe("boundary values", () => {
    it("handles very long strings", () => {
      const longString = "a".repeat(10_000);
      expect(transformInput(longString, enabledTransformers)).toBe(longString);
      expect(transformOutput(longString, enabledTransformers)).toBe(longString);
    });

    it("handles large numbers", () => {
      const largeNum = Number.MAX_SAFE_INTEGER;
      expect(transformInput(largeNum, enabledTransformers)).toBe(largeNum);
      expect(transformOutput(largeNum, enabledTransformers)).toBe(largeNum);
    });

    it("handles negative numbers", () => {
      expect(transformInput(-42, enabledTransformers)).toBe(-42);
      expect(transformOutput(-42, enabledTransformers)).toBe(-42);
    });

    it("handles zero", () => {
      expect(transformInput(0, enabledTransformers)).toBe(0);
      expect(transformOutput(0, enabledTransformers)).toBe(0);
    });

    it("handles NaN (passes through)", () => {
      expect(transformInput(Number.NaN, enabledTransformers)).toBeNaN();
      expect(transformOutput(Number.NaN, enabledTransformers)).toBeNaN();
    });

    it("handles Infinity", () => {
      expect(
        transformInput(Number.POSITIVE_INFINITY, enabledTransformers),
      ).toBe(Number.POSITIVE_INFINITY);
      expect(
        transformInput(Number.NEGATIVE_INFINITY, enabledTransformers),
      ).toBe(Number.NEGATIVE_INFINITY);
    });

    it("handles empty string", () => {
      expect(transformInput("", enabledTransformers)).toBe("");
      expect(transformOutput("", enabledTransformers)).toBe("");
    });

    it("handles single character strings", () => {
      expect(transformOutput("{", enabledTransformers)).toBe("{");
      expect(transformOutput("[", enabledTransformers)).toBe("[");
    });
  });
});
