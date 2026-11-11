<!-- description: Hold a program of independent steps as data in Java with Free Applicative: read an order's prices before they run, fetch them in one call, report every unknown SKU. -->

# Free Applicative: Programs You Can Read Whole

_No step waits on another, so the whole program is known before any of it runs._

~~~admonish abstract title="Free Applicative at a glance"
| | |
|---|---|
| **Models** | A program of instructions that do not depend on one another, held as data and known whole before it runs |
| **Replaces** | Independent calls made one at a time, when you want to count, check or batch them first |
| **Effect Path** | [`FreeApPath`](../glossary/effect-paths.md#freeappath) |
| **Instances** | `Functor`, `Applicative` |
| **Choose it when** | No step needs the result of another; otherwise [Free](free_monad.md), or compare every type in [Choosing a Type](supported-types.md#choosing-a-type) |
~~~

~~~admonish info title="What You'll Learn"
- Build an order's prices as one program whose instructions are all known before it runs
- Count a program's instructions and list what it will ask for, without running it
- Price every line with one catalogue call, by reading the program first
- Report every unknown SKU at once, by interpreting into `Validated`
- Choose between Free Applicative and Free, and hold one inside the other
~~~

~~~admonish example title="See Example Code"
**The code on this page is [FreeApplicativeBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/foundations/freeap/FreeApplicativeBook.java)**: the page includes it, so the build compiles and runs it. [FreeApplicativeBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/foundations/freeap/FreeApplicativeBookTest.java) holds what the page says each method does.
~~~

~~~admonish tip title="Where Free Applicative fits"
[`@EffectAlgebra`](../effect/effect_handlers.md#defining-effects) generates an instruction set's encoding, its `Functor` and its interpreter base class, and those serve a Free Applicative program as they serve a [Free](free_monad.md) one. Its generated constructors build `Free` programs only, so a `FreeAp` program lifts each instruction itself, as this page's `priceOf` does. [FreeApPath](../effect/path_freeap.md) documents the Path's operations; this page shows what independent steps buy you.
~~~

---

## Steps that do not depend on one another {#steps-that-do-not-depend-on-one-another}

Before checkout, the order service prices each line of a basket again from today's catalogue. In a [Free](free_monad.md) program each step may wait on the result of the one before, so an analysis [sees only as far as the first step that waits](free_monad.md#what-can-be-seen-before-it-runs). No line's price waits on another's, so the basket can be held as a Free Applicative program instead. Its steps are combined with `zipWith`, which gives neither step the other's result, and so every instruction is known before the program runs.

The instructions are the `OrderOp` records the [Free](free_monad.md#instructions-held-as-data) page uses. Each carries a continuation `k`, from the instruction's result to what the program does next, and `@EffectAlgebra` generates `OrderOpKind`, `OrderOpFunctor` and `OrderOpInterpreter` from them:

```java
/**
 * The order service's instructions, held as data so that a program built from them can be inspected
 * before an interpreter runs it. {@code @EffectAlgebra} generates the {@code Kind} encoding, the
 * {@code Functor}, the interpreter base class and the {@code Free} constructors.
 */
@NullMarked
@EffectAlgebra
public sealed interface OrderOp<A> permits OrderOp.PriceOf, OrderOp.Cancel {

  /** Maps a function over the result type. */
  <B> OrderOp<B> mapK(Function<? super A, ? extends B> f);

  /**
   * Looks up the price of a SKU.
   *
   * @param sku the SKU to price
   * @param k continuation from the price to {@code A}
   * @param <A> the result type
   */
  record PriceOf<A>(String sku, Function<BigDecimal, A> k) implements OrderOp<A> {
    @Override
    public <B> OrderOp<B> mapK(Function<? super A, ? extends B> f) {
      return new PriceOf<>(sku, k.andThen(f));
    }
  }

  /**
   * Cancels an order.
   *
   * @param orderId the order to cancel
   * @param k continuation from {@link Unit} to {@code A}
   * @param <A> the result type
   */
  record Cancel<A>(UUID orderId, Function<Unit, A> k) implements OrderOp<A> {
    @Override
    public <B> OrderOp<B> mapK(Function<? super A, ? extends B> f) {
      return new Cancel<>(orderId, k.andThen(f));
    }
  }
}
```

The code on this page uses these imports:

<!-- verify -->
```java
import static org.higherkindedj.example.book.foundations.OrderOpKindHelper.ORDER_OP;
import static org.higherkindedj.hkt.constant.ConstKindHelper.CONST;
import static org.higherkindedj.hkt.free_ap.FreeApKindHelper.FREE_AP;
import static org.higherkindedj.hkt.id.IdKindHelper.ID;
import static org.higherkindedj.hkt.instances.Witnesses.id;
import static org.higherkindedj.hkt.validated.ValidatedKindHelper.VALIDATED;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.higherkindedj.example.book.foundations.OrderOp;
import org.higherkindedj.example.book.foundations.OrderOpFunctor;
import org.higherkindedj.example.book.foundations.OrderOpInterpreter;
import org.higherkindedj.example.book.foundations.OrderOpKind;
import org.higherkindedj.example.book.foundations.OrderOpOps;
import org.higherkindedj.example.book.optics.cast.LineItem;
import org.higherkindedj.hkt.Functor;
import org.higherkindedj.hkt.Kind;
import org.higherkindedj.hkt.Monoids;
import org.higherkindedj.hkt.Semigroups;
import org.higherkindedj.hkt.Unit;
import org.higherkindedj.hkt.constant.Const;
import org.higherkindedj.hkt.constant.ConstKind;
import org.higherkindedj.hkt.effect.FreeApPath;
import org.higherkindedj.hkt.effect.FreePath;
import org.higherkindedj.hkt.effect.Path;
import org.higherkindedj.hkt.free.Free;
import org.higherkindedj.hkt.free.ProgramAnalyser;
import org.higherkindedj.hkt.free.ProgramAnalysis;
import org.higherkindedj.hkt.free_ap.FreeAp;
import org.higherkindedj.hkt.free_ap.FreeApAnalyzer;
import org.higherkindedj.hkt.free_ap.FreeApApplicative;
import org.higherkindedj.hkt.free_ap.FreeApKind;
import org.higherkindedj.hkt.id.Id;
import org.higherkindedj.hkt.id.IdKind;
import org.higherkindedj.hkt.instances.Instances;
import org.higherkindedj.hkt.validated.Validated;
import org.higherkindedj.hkt.validated.ValidatedKind;
```

`Path.freeApLift` puts one instruction on a `FreeApPath`. `Function.identity()` is its continuation, which hands the price straight back as the step's result:

```java
  static final Functor<OrderOpKind.Witness> ORDER_OPS = OrderOpFunctor.instance();

  // One instruction, held as data: nothing is priced until an interpreter runs it
  static FreeApPath<OrderOpKind.Witness, BigDecimal> priceOf(String sku) {
    return Path.freeApLift(
        ORDER_OP.widen(new OrderOp.PriceOf<>(sku, Function.identity())), ORDER_OPS);
  }

```

A line's total is its price times its quantity, and the basket's total adds the lines together with `zipWith`:

```java
  // A line at today's price: the price times the quantity
  static FreeApPath<OrderOpKind.Witness, BigDecimal> lineTotal(LineItem line) {
    return priceOf(line.sku()).map(price -> price.multiply(BigDecimal.valueOf(line.quantity())));
  }

  // Every line priced again; no line's price waits on another's
  static FreeApPath<OrderOpKind.Witness, BigDecimal> basketTotal(List<LineItem> lines) {
    return lines.stream()
        .map(FreeApplicativeBook::lineTotal)
        .reduce(
            Path.freeApPure(BigDecimal.ZERO, ORDER_OPS), (a, b) -> a.zipWith(b, BigDecimal::add));
  }

```

Nothing has been priced. `BASKET` holds one lamp and four bulbs, added last week at 38.00 and 2.40 each. The catalogue now prices a `LAMP` at 40.00 and a `BULB` at 2.50, so the basket comes to 50.00.

## Reading a program before it runs {#reading-a-program-before-it-runs}

An analysis is an interpreter too. This one turns each instruction into the SKU it would price, held in a [Const](const_type.md), which carries a value through the program and ignores what each step would give:

```java
  // An analysis is an interpreter too: each instruction gives the SKU it would price, in a Const
  static final class SkusToPrice extends OrderOpInterpreter<ConstKind.Witness<List<String>>> {
    @Override
    protected <A> Kind<ConstKind.Witness<List<String>>, A> handlePriceOf(OrderOp.PriceOf<A> op) {
      return CONST.widen(new Const<>(List.of(op.sku())));
    }

    @Override
    protected <A> Kind<ConstKind.Witness<List<String>>, A> handleCancel(OrderOp.Cancel<A> op) {
      return CONST.widen(new Const<>(List.of()));
    }
  }

```

`FreeApAnalyzer` counts the instructions, and `analyseWith` runs the analysis, joining the lists with `Monoids.list()`, a [Monoid](../functional/semigroup_and_monoid.md) that appends:

```java
    FreeAp<OrderOpKind.Witness, BigDecimal> program = basketTotal(BASKET).toFreeAp();

    int instructions = FreeApAnalyzer.countOperations(program);
    // 2

    List<String> skus = FreeApAnalyzer.analyseWith(program, new SkusToPrice(), Monoids.list());
    // [LAMP, BULB]
```

Nothing has been priced yet. A program of any length can be read: a basket of ten thousand lines is counted, analysed and run without overflowing the stack.

## One catalogue call for the whole basket {#one-catalogue-call-for-the-whole-basket}

Priced one line at a time, a basket of ten lines makes ten calls to the catalogue service: the N+1 problem, as when a loop of `findById` calls could have been one `IN (...)` query. Read first, it makes one call. `priceInOneCall` lists the SKUs, asks the catalogue for all of them at once, and then runs the program with an interpreter that prices from what came back:

```java
  // The catalogue service prices many SKUs in one call
  interface Catalogue {
    Map<String, BigDecimal> pricesFor(List<String> skus);
  }

  // Prices each instruction from prices already fetched, and records any cancellation
  static final class FetchedPrices extends OrderOpInterpreter<IdKind.Witness> {
    private final Map<String, BigDecimal> prices;
    final List<UUID> cancelled = new ArrayList<>();

    FetchedPrices(Map<String, BigDecimal> prices) {
      this.prices = prices;
    }

    @Override
    protected <A> Kind<IdKind.Witness, A> handlePriceOf(OrderOp.PriceOf<A> op) {
      return ID.widen(Id.of(op.k().apply(prices.get(op.sku()))));
    }

    @Override
    protected <A> Kind<IdKind.Witness, A> handleCancel(OrderOp.Cancel<A> op) {
      cancelled.add(op.orderId());
      return ID.widen(Id.of(op.k().apply(Unit.INSTANCE)));
    }
  }

  // Reads the SKUs first, asks the catalogue once, then runs the program
  static BigDecimal priceInOneCall(
      FreeApPath<OrderOpKind.Witness, BigDecimal> program, Catalogue catalogue) {
    List<String> skus =
        FreeApAnalyzer.analyseWith(program.toFreeAp(), new SkusToPrice(), Monoids.list());
    FetchedPrices fetched = new FetchedPrices(catalogue.pricesFor(skus));
    return ID.narrow(program.foldMap(fetched, Instances.monad(id())).runKind()).value();
  }

```

A stand-in catalogue records each call it is given, so the run can count them:

```java
    // A stand-in catalogue that records each call, and prices from CATALOGUE
    List<List<String>> calls = new ArrayList<>();
    Catalogue catalogue =
        requested -> {
          calls.add(requested);
          return CATALOGUE;
        };

    BigDecimal total = priceInOneCall(basketTotal(BASKET), catalogue);
    // 50.00

    int catalogueCalls = calls.size();
    // 1
```

`foldMap` hands the instructions to the interpreter in the order `zipWith` and `map2` wrote them, here the lamp and then the bulbs.

## Every unknown SKU at once {#every-unknown-sku-at-once}

An interpreter into [`Validated`](validated_monad.md) gives each price, or a failure naming the SKU the catalogue does not know:

```java
  // Gives a price, or a failure naming the SKU the catalogue does not know
  static final class CheckedPrices extends OrderOpInterpreter<ValidatedKind.Witness<List<String>>> {
    @Override
    protected <A> Kind<ValidatedKind.Witness<List<String>>, A> handlePriceOf(
        OrderOp.PriceOf<A> op) {
      BigDecimal price = CATALOGUE.get(op.sku());
      return price == null
          ? VALIDATED.widen(Validated.invalid(List.of("no price for " + op.sku())))
          : VALIDATED.widen(Validated.valid(op.k().apply(price)));
    }

    @Override
    protected <A> Kind<ValidatedKind.Witness<List<String>>, A> handleCancel(OrderOp.Cancel<A> op) {
      return VALIDATED.widen(Validated.valid(op.k().apply(Unit.INSTANCE)));
    }
  }

```

This basket holds two SKUs the catalogue does not know. `Validated`'s `ap` keeps the failures of both sides, so the run reports both:

```java
    List<LineItem> withUnknowns =
        List.of(
            new LineItem("RUG", 1, new BigDecimal("120.00")),
            new LineItem("LAMP", 1, new BigDecimal("38.00")),
            new LineItem("VASE", 2, new BigDecimal("15.00")));

    Validated<List<String>, BigDecimal> checked =
        VALIDATED.narrow(
            basketTotal(withUnknowns)
                .foldMap(new CheckedPrices(), Instances.validated(Semigroups.list()))
                .runKind());

    List<String> problems = checked.getError();
    // [no price for RUG, no price for VASE]
```

The same lines as a `Free` program, interpreted the same way, report only the rug. Each of its steps waits on the one before, and `Validated`'s `flatMap` has no result to hand on after a failure.

## Free or Free Applicative {#free-or-free-applicative}

Ask whether a step needs the result of one before it. If it does, the program is a [Free](free_monad.md) one. If none does, it can be a Free Applicative one, and it gains what this page has shown:

| | `Free` | Free Applicative |
|---|---|---|
| A step can | Wait on the result before it, and choose what comes next | Not see any other step's result |
| Known before it runs | Up to the first step that waits on a result | Every instruction |
| Built with | `via` | `zipWith` and `map` |
| Run in | A `Monad` | An `Applicative`, such as `Validated`, which keeps every failure, or `Const`, which reads the program |

Independent instructions can also run at the same time. Interpreted into `CompletableFuture`, whose `ap` combines futures already running, an interpreter that starts each price with `supplyAsync` prices the lamp and the bulbs at once.

## Inside a Free program {#inside-a-free-program}

A real program often has both kinds of step: the basket's prices, which are independent, then a decision that needs their total. `Free.Ap` holds a Free Applicative program as one step of a `Free` one:

```java
  // The basket's prices as one step of a Free program; the next step needs the total
  static FreePath<OrderOpKind.Witness, Boolean> cancelIfTotalOver(
      UUID orderId, List<LineItem> lines, BigDecimal limit) {
    FreePath<OrderOpKind.Witness, BigDecimal> total =
        Path.free(new Free.Ap<>(basketTotal(lines).toFreeAp()), ORDER_OPS);
    return total.via(
        sum ->
            sum.compareTo(limit) > 0
                ? Path.free(OrderOpOps.cancel(orderId, Function.identity()), ORDER_OPS)
                    .map(_ -> true)
                : Path.freePure(false, ORDER_OPS));
  }

```

`LIMIT` is 30.00, and the basket comes to 50.00:

```java
    FetchedPrices store = new FetchedPrices(CATALOGUE);

    boolean cancelled =
        ID.narrow(
                cancelIfTotalOver(ORDER, BASKET, LIMIT)
                    .foldMap(store, Instances.monad(id()))
                    .runKind())
            .value();
    // true

    ProgramAnalysis analysis =
        ProgramAnalyser.analyse(cancelIfTotalOver(ORDER, BASKET, LIMIT).toFree());

    // ProgramAnalyser counts the basket's FreeAp as one parallel scope, and does not look inside
    int basketSteps = analysis.parallelScopes();
    // 1
```

`ProgramAnalyser` counts the basket as one step, a parallel scope, and does not look inside it. Read the basket with `FreeApAnalyzer` before you wrap it.

## A program always gives a value {#a-program-always-gives-a-value}

`Path.freeApPure(null, functor)` and `FreeAp.pure(null)` throw at the call, and a `map` or `zipWith` function that returns `null` fails the program when it is interpreted. [A Task Always Gives a Value](vtask_monad.md#a-task-always-gives-a-value) sets out the rule every lazy type follows.

## Creating instances {#creating-instances}

`Path.freeApLift(fa, functor)` lifts one instruction onto a `FreeApPath`, `Path.freeApPure(value, functor)` holds a result with no instruction, and `Path.freeAp(freeAp, functor)` puts a `FreeAp` on a Path. Without a Path, `FreeAp.lift(fa)` and `FreeAp.pure(value)` build a `FreeAp` directly, and need no `Functor`.

## Methods {#methods}

On a `FreeApPath`:

| Method | What it does |
|---|---|
| `map(f)` | Change the result |
| `zipWith(other, f)`, `zipWith3(b, c, f)` | Combine programs whose steps do not see one another's results |
| `foldMap(interpreter, monad)` | Run the program, giving a `GenericPath` in the target monad |
| `foldMapKind(interpreter, applicative)` | Run the program in any `Applicative`, giving a `Kind` |
| `toFreeAp()` | Get the `FreeAp` |

On a `FreeAp`, and with `FreeApAnalyzer`:

| Method | What it does |
|---|---|
| `map2(other, f)`, `ap(ff)` | Combine two programs |
| `foldMap(interpreter, applicative)` | Run the program, giving a `Kind`; `analyse(...)` is the same call, named for an analysis |
| `retract(applicative)` | Run a program whose instructions are already an `Applicative`, such as `IO`, with no interpreter |
| `FreeApAnalyzer.countOperations(program)` | Count the instructions |
| `FreeApAnalyzer.collectOperations(program)`, `groupByType(program, narrow)` | List the instructions, or count them by record type |
| `FreeApAnalyzer.containsOperation(program, test)` | Ask whether any instruction passes a test |
| `FreeApAnalyzer.analyseWith(program, analysis, monoid)` | Run an analysis into `Const`, joining its values with the monoid |

## Working with Kind {#working-with-kind}

`FREE_AP.widen` and `FREE_AP.narrow`, from `FreeApKindHelper`, convert between a `FreeAp` and its `Kind`. Generic code takes it through `FreeApApplicative.instance()`, whose `map2` builds the program as `FreeAp`'s own does:

```java
    FreeApApplicative<OrderOpKind.Witness> applicative = FreeApApplicative.instance();

    // A FreeAp is already its own Kind, so widen and narrow are casts
    Kind<FreeApKind.Witness<OrderOpKind.Witness>, BigDecimal> lamp =
        FREE_AP.widen(priceOf("LAMP").toFreeAp());
    Kind<FreeApKind.Witness<OrderOpKind.Witness>, BigDecimal> bulb =
        FREE_AP.widen(priceOf("BULB").toFreeAp());

    Kind<FreeApKind.Witness<OrderOpKind.Witness>, BigDecimal> both =
        applicative.map2(lamp, bulb, BigDecimal::add);

    BigDecimal lampAndBulb =
        ID.narrow(FREE_AP.narrow(both).foldMap(new FetchedPrices(CATALOGUE), Instances.monad(id())))
            .value();
    // 42.50
```

`FreeApApplicative` has no `flatMap`: a Free Applicative program is an `Applicative` and never a `Monad`, which is what keeps every instruction in view.

## When to use Free Applicative {#when-to-use-free-applicative}

| You need | Use |
|---|---|
| Independent lookups counted, checked or batched before they run | Free Applicative |
| Every failure among independent checks | Free Applicative run in `Validated`, or [Validated](validated_monad.md) directly |
| A step that needs another's result | [Free](free_monad.md), holding a Free Applicative step where the steps are independent |
| Several instruction sets in one program | [EitherF](eitherf.md) |
| Independent work run once, one way | [VTask](vtask_monad.md)'s `Par`, or a direct call |

~~~admonish info title="Hands-On Learning"
Practise building programs in [Tutorial 10: Free Applicative](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/coretypes/Tutorial10_FreeApplicative.java) (6 exercises), and reading them in [Tutorial 11: Static Analysis](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/coretypes/Tutorial11_StaticAnalysis.java) (10 exercises), from the [Advanced Patterns](../tutorials/coretypes/advanced_journey.md) journey.
~~~

---

**Previous:** [Free](free_monad.md)
**Next:** [EitherF](eitherf.md)
