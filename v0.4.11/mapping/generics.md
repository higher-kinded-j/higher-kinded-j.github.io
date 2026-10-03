# Generic Specs {#generic-records-concrete-threaded-and-element-mapped}

_Concrete, threaded, and element-mapped: three ways to map a generic record, one rule for how you reach the Impl._

A generic record such as `Page<T>` raises a question a non-generic pair never does. Is the mapping for one instantiation, for every instantiation, or for element types only the caller can convert? All three are supported, and the answer decides how you reach the generated Impl. No generic records at your boundary? Skip ahead to [Merge and Error Envelopes](merge_envelopes.md), and return when a `Page<T>` appears.

~~~admonish info title="What You'll Learn"
- Tell a spec's form from its declaration, and reach its Impl
- Predict what a swapped `of(...)` does, and pass the prisms in declaration order
~~~

~~~admonish example title="See Example Code"
**The code on this page is [GenericsBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/mapping/GenericsBook.java) and its [GenericsBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/mapping/GenericsBookTest.java)** - the page includes them directly, so they are compiled and run by the build.
~~~

## One rule, three access shapes {#one-rule-three-access-shapes}

Two questions about the spec decide its form, and so how you reach its Impl. Does it declare type parameters of its own, and does it declare an abstract leaf, a leaf method with no `default` body?

| Form | The spec | Use when | Access | Why |
|---|---|---|---|---|
| Concrete | names its type arguments: `MappingSpec<Page<Customer>, PageDto<CustomerDto>>` | one element type | `XImpl.INSTANCE` only | no type parameters: a plain constant |
| Threaded | declares its own: `PageMapping<T>`, over `MappingSpec<Page<T>, PageDto<T>>` | both sides hold the same element type, copied as is | `XImpl.instance()` | a static field cannot mention `T`, so one shared instance sits behind a generic method, as with `Collections.emptyList()` |
| Element-mapped | declares an abstract leaf, `ValidatedPrism<TDto, T> items()` | the element types differ, and the caller picks the conversion | `XImpl.of(prisms)` | it carries the caller's prisms: each `of(...)` call is a fresh, immutable instance |

---

## Concrete instantiations {#concrete-instantiations}

A **concrete** spec names the type arguments, and every component maps as if the record were written with `Customer` in place of `T`. Everything else on a record works unchanged, the null rule and located indexes included:

``` java
record Page<T>(List<T> items, int total) {}

record PageDto<T>(List<T> items, int total) {}

@GenerateMapping
interface CustomerPageMapping extends MappingSpec<Page<Customer>, PageDto<CustomerDto>> {}


    Validated<NonEmptyList<FieldError>, Page<Customer>> page =
        CustomerPageMappingImpl.INSTANCE.parse(
            new PageDto<>(
                List.of(new CustomerDto("Ada", "ada@corp.example"), new CustomerDto("Bob", "nope")),
                2));
    // Invalid(NonEmptyList[items.1.email: not an email address])
```

A concrete mapping nests like any other, so `Report(Page<Customer> results)` nests it automatically when it is the only spec for the pair.

---

## Threaded specs {#threaded-specs}

A **threaded** spec declares its own type parameters, and one mapping serves every instantiation. Elements typed by the same variable on both sides copy as they are, and `parse` still checks each one, so a `null` element is reported as `items.1: must not be null`. The whole surface is generic, including [`asIso()`](tiers.md), a two-way conversion that cannot fail, on a pair that loses nothing:

``` java
@GenerateMapping
interface PageMapping<T> extends MappingSpec<Page<T>, PageDto<T>> {}

// one Impl for every T: PageMappingImpl.<String>instance(), .<Integer>instance(), ...


    // One generic Impl serves every instantiation, and the elements copy as they are.
    Page<String> tags = new Page<>(List.of("kitchen", "sale"), 2);
    PageDto<String> tagsDto = PageMappingImpl.<String>instance().build(tags);
    // PageDto[items=[kitchen, sale], total=2]
    Validated<NonEmptyList<FieldError>, Page<Integer>> counts =
        PageMappingImpl.<Integer>instance().parse(new PageDto<>(List.of(1, 2, 3), 3));
    // Valid(Page[items=[1, 2, 3], total=3])
```

A chained call such as `PageMappingImpl.<String>instance().build(tags)` gives Java nothing to infer `T` from, so it spells the type argument. Bound to a variable typed as the Impl, plain `instance()` is enough:

``` java
    PageMappingImpl<String> tagPages = PageMappingImpl.instance(); // T inferred from the variable
    PageDto<String> again = tagPages.build(tags);
```

Multi-parameter and bounded specs thread too (`ResultMapping<E, A>`, `RankedMapping<T extends Number>`), and a same-typed `default` leaf (`ValidatedPrism<T, T>`) is applied to each element. A threaded spec nests as well. The processor matches `Page<String>` against `Page<T>`, so `TagSearch(Page<String> results)` uses `PageMappingImpl.<String>instance()`, and a generic outer spec passes its own variable straight through, as `PageMappingImpl.<T>instance()`.

---

## Element-mapped specs {#element-mapped-specs}

An **element-mapped** spec declares its element mapping as an abstract leaf, usually because the two sides use different variables, `Page<T>` against `PageDto<TDto>`. Nothing on the spec can parse a `TDto` into a `T`, so the Impl leaves it to the caller. Each abstract leaf becomes a parameter of a public `of(...)` factory:

``` java
// The element mapping is deliberately open: an abstract leaf, supplied at of(...) time.
@GenerateMapping
interface CodecPageMapping<T, TDto> extends MappingSpec<Page<T>, PageDto<TDto>> {
  ValidatedPrism<TDto, T> items();
}


    // One spec, any element codec: each abstract leaf arrives as a prism through of(...).
    Validated<NonEmptyList<FieldError>, Page<EmailAddress>> mail =
        CodecPageMappingImpl.of(EmailCodecs.EMAIL)
            .parse(new PageDto<>(List.of("ada@example.org", "nope"), 2));
    // Invalid(NonEmptyList[items.1: not an email address])
```

A prism can be another mapping's `asValidatedPrism()`, so `CodecPageMappingImpl.of(CustomerMappingImpl.INSTANCE.asValidatedPrism())` maps a page of customers. Each `of(...)` call allocates a new Impl, so build one where it is used and keep it.

~~~admonish warning title="Not checked for you: pass the prisms in declaration order"
`of(...)` takes one prism per abstract leaf, in the order the spec declares the leaves. Two leaves of the same type swap without a compile error, and each value then parses through the other's leaf, perhaps to a wrong value with no error at all. The generated `of(opens, closes)` names each parameter after its leaf, so your IDE's parameter hints show the order.
~~~

Where a record nests an element-mapped spec, the processor composes it, so a `MailingList(Page<EmailAddress> entries)` reports `entries.items.1: not an email address`. [How an element-mapped spec nests](rules.md#element-mapped-nesting) says what supplies each prism.

~~~admonish note title="Declare one form for each pair a record nests"
A generic spec covers every instantiation it matches, so it competes with a concrete spec for the same pair: `CodecPageMapping<T, TDto>` covers `Page<Customer>` against `PageDto<CustomerDto>` too. Declared side by side, as on this page, a record nesting `Page<Customer>` stops with [`matches more than one mapping spec`](compiler_errors.md#more-than-one-spec) until a leaf picks one. Declare one form for each pair a record nests.
~~~

Generic mappings are record-to-record only. A generic type on a bean wire, a PATCH or a sealed hierarchy is not supported yet, even at a concrete instantiation. Model an envelope such as `Result<E, A>` as a record. [The boundaries of a generic spec](rules.md#generic-boundaries) lists what else the processor diagnoses.

~~~admonish tip title="You can ship now"
You can now map a generic record for one instantiation, for every instantiation, or with element prisms the caller supplies, and reach each Impl. The rest of this page, [generic mix-ins](#generic-mix-ins), is for when you need it.
~~~

~~~admonish question title="Checkpoint: how do you reach this Impl?" id="check-generics-access"
`TagPageMapping` maps generic records:

``` java
@GenerateMapping
interface TagPageMapping extends MappingSpec<Page<String>, PageDto<String>> {}

```

How does code reach its generated Impl?

1. `TagPageMappingImpl.INSTANCE`
2. `TagPageMappingImpl.<String>instance()`
3. `TagPageMappingImpl.of()`
4. Either of the first two
~~~

~~~admonish success title="Answer and why" collapsible=true id="check-generics-access-answer"
**1.** The spec declares no type parameters of its own and no abstract leaf. It names `String`, so it is concrete, whatever the records declare, and a concrete Impl is reached through `INSTANCE` only:

``` java
    PageDto<String> wire = TagPageMappingImpl.INSTANCE.build(new Page<>(List.of("kitchen"), 1));
    assertThat(wire).isEqualTo(new PageDto<>(List.of("kitchen"), 1));

    assertThatThrownBy(() -> TagPageMappingImpl.class.getMethod("instance"))
        .isInstanceOf(NoSuchMethodException.class); // no generic accessor
```

Where this lives: [One rule, three access shapes](#one-rule-three-access-shapes).
~~~

~~~admonish question title="Checkpoint: what does a swapped `of(...)` do?" id="check-generics-swap"
A partner marketplace sends a sale period assembled by two of its systems, `opens` as a UK date (`dd/MM/uuuu`) and `closes` as a US one (`MM/dd/uuuu`):

``` java
record SalePeriod<T>(T opens, T closes) {}

record SalePeriodDto<TDto>(TDto opens, TDto closes) {}

@GenerateMapping
interface SalePeriodMapping<T, TDto> extends MappingSpec<SalePeriod<T>, SalePeriodDto<TDto>> {
  ValidatedPrism<TDto, T> opens();

  ValidatedPrism<TDto, T> closes();
}

```

The caller writes `SalePeriodMappingImpl.of(us, uk)`, and parses `new SalePeriodDto<>("03/04/2026", "05/04/2026")`. What happens?

1. A compile error: the prisms are in the wrong order
2. It compiles, and `parse` reports both dates, located
3. It parses, to the wrong dates, with no error
4. It parses correctly: `of(...)` matches each prism to its leaf
~~~

~~~admonish success title="Answer and why" collapsible=true id="check-generics-swap-answer"
**3.** `of(...)` takes the prisms in declaration order, `opens` then `closes`, and both have the same type, so the swap compiles. Each date then parses through the other's codec, and both formats accept both strings, so `opens` reads as 4 March and `closes` as 5 April, with no error:

``` java
    ValidatedPrism<String, LocalDate> uk = // 03/04/2026 is 3 April
        StandardCodecs.localDate(DateTimeFormatter.ofPattern("dd/MM/uuuu"));
    ValidatedPrism<String, LocalDate> us = // 05/04/2026 is 4 May
        StandardCodecs.localDate(DateTimeFormatter.ofPattern("MM/dd/uuuu"));
    SalePeriodDto<String> request = new SalePeriodDto<>("03/04/2026", "05/04/2026");

    assertThatValidated(SalePeriodMappingImpl.of(uk, us).parse(request)) // opens, then closes
        .hasValue(new SalePeriod<>(LocalDate.of(2026, 4, 3), LocalDate.of(2026, 5, 4)));
    assertThatValidated(SalePeriodMappingImpl.of(us, uk).parse(request)) // swapped: it compiles
        .hasValue(new SalePeriod<>(LocalDate.of(2026, 3, 4), LocalDate.of(2026, 4, 5))); // no error
```

When the caller does not need to choose the codec, a concrete spec with a `default` leaf on each field names the codec where it applies, and cannot be swapped.

Where this lives: [Element-mapped specs](#element-mapped-specs).
~~~

---

## Generic mix-ins {#generic-mix-ins}

A [mix-in](codecs.md#shared-vocabulary-mix-in-interfaces) may declare type parameters of its own. Its members are read under the spec's instantiation, so a shared vocabulary parameterised by the type it speaks about contributes at the type the spec gives it:

``` java
// Vocabulary parameterised by the type it speaks about: one interface, reused wherever the
// domain component happens to land.
interface Renames<T> {
  @MapField(to = "fullName")
  T name();
}

// The interface below it says what T is. The spec never repeats it, and never sees a T.
interface TextRenames extends Renames<String> {}

// Record Mapping Basics' Courier(String name, EmailAddress email), on a carrier's roster of its
// couriers, which calls the name fullName.
record CourierRosterDto(String fullName, String email) {}

@GenerateMapping
interface CourierRosterMapping extends TextRenames, MappingSpec<Courier, CourierRosterDto> {
  default ValidatedPrism<String, EmailAddress> email() {
    return EmailCodecs.EMAIL;
  }
}

```

`name()` says `T` where it is declared, and `String` where the spec has it, and that is what the generated Impl carries. It holds however many interfaces separate the two, and a spec's own type parameters survive as themselves. A leaf of an element-mapped spec can come from a generic mix-in too, and [leaf order in `of(...)`](rules.md#leaf-order-in-of) says where its parameter falls.

The one shape this cannot answer for is a **raw** supertype anywhere on the route. The processor refuses one that contributes a member, and [a generic mix-in reached raw](rules.md#a-generic-mix-in-reached-raw) says which clause to edit.

---

~~~admonish info title="Key Takeaways"
* **Three generic forms**: a concrete instantiation, a threaded spec and an element-mapped spec, told apart by the spec's type parameters and abstract leaves
* **Access follows the form**: `INSTANCE` for a concrete spec, `instance()` for a threaded one, and `of(...)` for one that takes the caller's prisms
* **The compiler does not check `of(...)`'s order**: two prisms of the same type swap silently, perhaps to wrong values with no error
~~~

~~~admonish tip title="See Also"
- [Nesting, Containers, and Sealed Hierarchies](structure.md): How one spec nests in another, which generic mappings follow
- [The null contract, precisely](rules.md#the-null-contract-precisely): The null-element check that identity-copied elements go through
- [Injecting, Testing, and Diagnostics](testing.md): Registering an element-mapped Impl as a bean
~~~

---

**Previous:** [Sparse PATCH](beans_patch.md)
**Next:** [Merge and Error Envelopes](merge_envelopes.md)
