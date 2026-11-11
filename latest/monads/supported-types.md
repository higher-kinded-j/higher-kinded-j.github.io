<!-- description: Find the Higher-Kinded-J type for the Java you write today, such as Maybe for a method that may return null, and see which type classes each type supports. -->

# Supported Types

_Find the type for the code you write today, and see which type classes each type supports._

## Choosing a Type {#choosing-a-type}

Find the code you write today, or the Java type it already gives you, in the first column. Application code holds the type beside it through the [Effect Path](../effect/ch_intro.md) in the last column, where it has one.

| Your code today | Type | Effect Path |
|---|---|---|
| **Failure** | | |
| A method that throws a checked exception | [Either](either_monad.md) | [`EitherPath`](../effect/path_either.md) |
| Error messages collected in a `List`, or Bean Validation's `Set<ConstraintViolation>` | [Validated](validated_monad.md) | [`ValidationPath`](../effect/path_validation.md) |
| A `try`/`catch` block around a call that throws | [Try](try_monad.md) | [`TryPath`](../effect/path_try.md) |
| A result record holding a value and a list of warnings | [EitherOrBoth](either_or_both_monad.md) | [`EitherOrBothPath`](../effect/path_either_or_both.md) |
| A `List` checked with `isEmpty()` before `getFirst()` | [NonEmptyList](nonemptylist_monad.md) | None: a Path holds it, as [`ValidationPath`](../effect/path_validation.md) holds its errors |
| **Absence** | | |
| A method that may return `null` | [Maybe](maybe_monad.md) | [`MaybePath`](../effect/path_maybe.md) |
| A method you call already returns an `Optional` | [Optional](optional_monad.md) | [`OptionalPath`](../effect/path_optional.md) |
| **Deferred** | | |
| A method that performs its side effect as soon as it is called | [IO](io_monad.md) | [`IOPath`](../effect/path_io.md) |
| A field filled in on first use, behind a `null` check | [Lazy](lazy_monad.md) | `LazyPath`, shown in [On a `LazyPath`](lazy_monad.md#on-a-lazypath) |
| An API gives you a future, or the work is already running on another thread | [CompletableFuture](cf_monad.md) | `CompletableFuturePath`, shown in [On a `CompletableFuturePath`](cf_monad.md#on-a-completablefuturepath) |
| **Virtual threads** | | |
| A `Callable` submitted to an `ExecutorService`, and the `Future` you wait on | [VTask](vtask_monad.md) | [`VTaskPath`](../effect/path_vtask.md), and [`VResultPath`](../effect/path_vresult.md) for a typed error |
| A loop over a paged or blocking source, or a Java `Stream` or `Iterator` built over one | [VStream](vstream.md) | [`VStreamPath`](../effect/path_vstream.md) |
| **Environment and state** | | |
| Settings injected into a service, or passed down through every method that needs them | [Reader](reader_monad.md) | [`ReaderPath`](../effect/advanced_effects.md#readerpath-the-environment-you-inherit) |
| A `ThreadLocal`, set at the start of a request and cleared at the end | [Context](context_scoped.md) | None: `toVTask()` gives a [VTask](vtask_monad.md), and `Path.vtaskPath(task)` a [`VTaskPath`](../effect/path_vtask.md) |
| A field that each method changes, or methods that take a value and return a pair of the result and the new value | [State](state_monad.md) | [`WithStatePath`](../effect/advanced_effects.md#withstatepath-computation-with-memory) |
| A list passed to every method that logs, or a logger whose output a test has to capture | [Writer](writer_monad.md) | [`WriterPath`](../effect/advanced_effects.md#writerpath-accumulating-output) |
| **Collections** | | |
| Nested loops build every combination, and you keep them all in memory | [List](list_monad.md) | [`NonDetPath`](../glossary/effect-paths.md#nondetpath) for every combination, or [`ListPath`](../glossary/effect-paths.md#listpath), whose `zipWith` pairs by position |
| A method you call already returns a `Stream` | [Stream](stream_monad.md) | [`StreamPath`](../glossary/effect-paths.md#streampath), which reads a finite stream into memory so it can run again, or [takes a supplier](stream_monad.md#on-a-streampath) for an endless one |
| **Programs as data** | | |
| A plain value, where code written for any monad needs one | [Identity](identity.md) | [`IdPath`](../glossary/effect-paths.md#idpath), a step that cannot fail |
| A recursive method that overflows the stack, or a loop that keeps its own stack of work | [Trampoline](trampoline_monad.md) | [`TrampolinePath`](../glossary/effect-paths.md#trampolinepath) |
| Calls to an injected service, made directly from business code | [Free](free_monad.md) | [`FreePath`](../glossary/effect-paths.md#freepath) |
| Independent calls made one at a time, when you want to count, check or batch them first | [Free Applicative](free_applicative.md) | [`FreeApPath`](../glossary/effect-paths.md#freeappath) |
| One interface grown to hold every service's operations, or a dispatcher written by hand | [EitherF](eitherf.md) | None: a program over the pair is a [`FreePath`](../glossary/effect-paths.md#freepath) |
| A `Functor` written by hand for an instruction set, or a chain of `map` calls that each walk the structure | [Coyoneda](coyoneda.md) | None |
| A second loop written beside a traversal, to sum, count or collect what it visits | [Const](const_type.md) | None |

Each type's page opens with a card that names a neighbouring type for when that type does not fit.

An Effect Path can hold two effects at once: [`VResultPath`](../effect/path_vresult.md), for one, is a deferred task that fails with a typed error. Where no Path holds the pair you need, a monad transformer adds one effect to another, as [Other types with instances](#other-types-with-instances) shows.

## What each type supports {#what-each-type-supports}

| Type | Type classes |
|---|---|
| [`Either<L, R>`](either_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `MonadError<L>`, `Foldable`, `Traverse`, `Bifunctor` |
| [`Validated<E, A>`](validated_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `MonadError<E>`, `Foldable`, `Traverse`, `Bifunctor` |
| [`Try<T>`](try_monad.md) | `Functor`, `Applicative`, `Monad`, `MonadError<Throwable>`, `Foldable`, `Traverse` |
| [`EitherOrBoth<L, R>`](either_or_both_monad.md) | `Functor`, `Applicative`, `Monad`, `Foldable`, `Traverse`, `Bifunctor` |
| [`NonEmptyList<A>`](nonemptylist_monad.md) | `Functor`, `Applicative`, `Monad`, `Foldable`, `Traverse` |
| [`Maybe<T>`](maybe_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `MonadError<Unit>`, `Alternative`, `MonadZero`, `Foldable`, `Traverse` |
| [`Optional<T>`](optional_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `MonadError<Unit>`, `Alternative`, `MonadZero`, `Foldable`, `Traverse` |
| [`IO<A>`](io_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad` |
| [`Lazy<A>`](lazy_monad.md) | `Functor`, `Applicative`, `Monad` |
| [`CompletableFuture<T>`](cf_monad.md) | `Functor`, `Applicative`, `Monad`, `MonadError<Throwable>` |
| [`VTask<A>`](vtask_monad.md) | `Functor`, `Applicative`, `Monad`, `MonadError<Throwable>` |
| [`VStream<A>`](vstream.md) | `Functor`, `Applicative`, `Monad`, `Alternative`, `Foldable`, `Traverse` |
| [`Reader<R, A>`](reader_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad` |
| [`Context<R, A>`](context_scoped.md) | `Functor`, `Applicative`, `Monad` |
| [`State<S, A>`](state_monad.md) | `Functor`, `Applicative`, `Monad` |
| [`Writer<W, A>`](writer_monad.md) | `Functor`, `Applicative`, `Monad`, `Bifunctor` |
| [`List<E>`](list_monad.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `Alternative`, `MonadZero`, `Foldable`, `Traverse` |
| [`Stream<T>`](stream_monad.md) | `Functor`, `Applicative`, `Monad`, `Alternative`, `MonadZero`, `Foldable`, `Traverse` |
| [`Id<A>`](identity.md) | `Functor`, `Applicative`, `Selective`, `Monad`, `Foldable`, `Traverse` |
| [`Trampoline<A>`](trampoline_monad.md) | `Functor`, `Applicative`, `Monad` |
| [`Free<F, A>`](free_monad.md) | `Functor`, `Applicative`, `Monad` |
| [`FreeAp<F, A>`](free_applicative.md) | `Functor`, `Applicative` |
| [`EitherF<F, G, A>`](eitherf.md) | `Functor` |
| [`Coyoneda<F, A>`](coyoneda.md) | `Functor` |
| [`Const<C, A>`](const_type.md) | `Functor`, `Applicative`, `Bifunctor` |

A type class, such as `Functor` or `Traverse`, names operations that work on any type with an instance of it, so a row tells you which generic code accepts that type. [Type Classes](../functional/ch_intro.md) says what each one lets you call. Every row lists the classes in the same order, and includes each class a listed one extends, as [the hierarchy](../functional/ch_intro.md#the-hierarchy) shows. `MonadError<…>` names the error its instance raises and recovers from: the type's own `L` or `E`, a `Throwable`, or `Unit`, the bare absence of `Maybe` and `Optional`.

Two rows that match can still behave differently, because behaviour belongs to the instance: `Either`'s `ap` stops at the first error, and `Validated`'s keeps every one. A test reads the table from the library's classes, so it lists exactly the instances of these type classes the library has. [`Semigroup` and `Monoid`](../functional/semigroup_and_monoid.md), which take a plain type rather than a container, are left out. Some instances take arguments. `Validated`'s and `EitherOrBoth`'s take a `Semigroup` to join two errors, `Writer`'s and `Const`'s a `Monoid` to join two logs or two values, and `EitherF`'s a `Functor` for each side.

## Other types with instances {#other-types-with-instances}

A monad transformer, such as `EitherT`, adds one effect to a monad you choose, so its instance takes that monad's own, and `WriterT`'s a `Monoid` as well. `ReaderT`'s `MonadReader<…>`, `StateT`'s `MonadState<…>` and `WriterT`'s `MonadWriter<…>` name the environment, state or output each gives access to, and [MTL Capabilities](../transformers/mtl_capabilities.md) shows code written against them. `Tuple2` is a pair whose two sides [Bifunctor](../functional/bifunctor.md) maps, and `Function` a function whose input and output [Profunctor](../functional/profunctor.md) adapts. None of them has a Core Types page, so each row links the page that shows it.

| Type | Type classes |
|---|---|
| [`EitherT<F, L, R>`](../transformers/eithert_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadError<L>` |
| [`OptionalT<F, A>`](../transformers/optionalt_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadError<Unit>` |
| [`MaybeT<F, A>`](../transformers/maybet_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadError<Unit>` |
| [`ReaderT<F, R_ENV, A>`](../transformers/readert_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadReader<R_ENV>` |
| [`StateT<S, F, A>`](../transformers/statet_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadState<S>` |
| [`WriterT<F, W, A>`](../transformers/writert_transformer.md) | `Functor`, `Applicative`, `Monad`, `MonadWriter<W>` |
| [`Tuple2<A, B>`](../functional/bifunctor.md) | `Bifunctor` |
| [`Function<T, R>`](../functional/profunctor.md) | `Profunctor` |

Java has no higher-kinded types, so generic code reaches every type on this page through the same encoding, which [How the Encoding Works](../hkts/core-concepts.md#the-pieces-each-type-provides) shows.

![Two cartoon toys, one sweeping an arm towards the horizon while the other looks on, worried, captioned "Monads, monads, monads everywhere"](../images/monads_everywhere.webp)

~~~admonish info title="Hands-On Learning"
Practise with concrete types in [Tutorial 06: Concrete Types](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/coretypes/Tutorial06_ConcreteTypes.java) (7 exercises).
~~~

---

**Previous:** [Const](const_type.md)
**Next:** [Quick Reference](../hkts/quick_reference.md)
