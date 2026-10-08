# Updates That Can Fail

_Check a value as you update it, and choose whether the caller hears the first error or every one._

![A black-and-white photograph of a child in oversized goggles with spiral lenses](../images/lens2.jpg)

~~~admonish info title="What You'll Learn"
- Update a field through a check that may reject the new value
- Check every element of a list, and report every failure at once
- Choose between the first error, every error, or no detail at all
- Reach for `modifyF` when the effect is something else, such as an asynchronous call
~~~

~~~admonish example title="See Example Code"
**The code on this page is [FluentBook.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/main/java/org/higherkindedj/example/book/optics/fluent/FluentBook.java) and its [FluentBookTest.java](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/example/book/optics/fluent/FluentBookTest.java)**: the page includes them, so the build compiles and runs them.
~~~

A path's `modify` takes a function that always succeeds. A real update often has to check the new value first: an email must contain `@`, and a price must not be negative. `OpticOps`, the library's fluent API, runs the check through an optic and hands back the outcome as a value. That value is an `Either`, which holds the first error or the updated record; a `Validated`, which holds every error or the updated record; or a `Maybe`, the library's `Optional`. `OpticOps` takes the optic, which a path hands over with `toLens()` or `toTraversal()`, as [What a Path Is Made Of](optics_intro.md#each-path-type-wraps-an-optic) showed.

---

## Every element, every error {#every-element-every-error}

The records are an order of priced line items and a user:

``` java
@GenerateFocus
record LineItem(String sku, BigDecimal price) {}

@GenerateFocus
record Order(String id, List<LineItem> items) {}

@GenerateFocus
record User(String username, String email) {}

```

Checking every price on an order by hand is a loop that collects the errors:

``` java
    List<String> errors = new ArrayList<>();
    for (LineItem item : order.items()) {
      if (item.price().signum() < 0) {
        errors.add("Price cannot be negative: " + item.price());
      } else if (item.price().compareTo(MAXIMUM) > 0) {
        errors.add("Price exceeds maximum: " + item.price());
      }
    }
```

That loop works. It knows the order's shape, though, and it ends in a list you still have to turn into an answer, by throwing or by returning the order. Written once as a method that returns its verdict, the check goes through the optic instead:

``` java
  static final BigDecimal MAXIMUM = new BigDecimal("10000");

  static Validated<String, BigDecimal> checkPrice(BigDecimal price) {
    if (price.signum() < 0) {
      return Validated.invalid("Price cannot be negative: " + price);
    }
    return price.compareTo(MAXIMUM) > 0
        ? Validated.invalid("Price exceeds maximum: " + price)
        : Validated.valid(price);
  }

```

``` java
    Traversal<Order, BigDecimal> prices =
        OrderFocus.items().via(LineItemFocus.price()).toTraversal();

    Validated<List<String>, Order> checked =
        OpticOps.modifyAllValidated(order, prices, FluentBook::checkPrice);

    String report =
        checked.fold(
            errors -> errors.size() + " invalid prices: " + String.join("; ", errors),
            _ -> "all prices accepted");
```

For an order priced at -10.00, 25.00 and 15000.00, `checked` is `Invalid(["Price cannot be negative: -10.00", "Price exceeds maximum: 15000.00"])`, and `report` reads `"2 invalid prices: Price cannot be negative: -10.00; Price exceeds maximum: 15000.00"`. An order whose prices all pass comes back as `Valid`, holding the order. One call names both bad prices, and the answer is a value, which goes on to combine with other checks rather than end in a throw.

The check returns `Validated<String, BigDecimal>`, one error at most, and the result collects them as `Validated<List<String>, Order>`. The lifting into a list is done for you. `OpticOps` takes the source first, as a static utility method does.

---

## Four ways to fail {#part-2-validation-aware-modification}

Four methods differ only in what they tell the caller when a check fails:

| Method | Result | Behaviour | Best for |
|--------|--------|-----------|----------|
| `modifyEither` | `Either<E, S>` | First error wins | Sequential validation, fail fast |
| `modifyMaybe` | `Maybe<S>` | Success or nothing, no detail | Optional enrichment |
| `modifyAllValidated` | `Validated<List<E>, S>` | Accumulates every error | Forms, imports, user feedback |
| `modifyAllEither` | `Either<E, S>` | First error wins (every element is still evaluated) | A batch job that reports one error |

```mermaid
flowchart TD
    accTitle: Which validation method to use
    accDescr: If the caller needs to know why an update failed as soon as it failed, use modifyEither. If only whether it worked, modifyMaybe. If everything that is wrong in one pass, modifyAllValidated. If a batch job needs one error to report, modifyAllEither.
    Q{"What does the caller<br/>need to know?"}
    Q -->|"why it failed,<br/>as soon as it failed"| E(["modifyEither<br/>Either, first error"])
    Q -->|"only whether<br/>it worked"| M(["modifyMaybe<br/>Maybe, no detail"])
    Q -->|"everything that is wrong,<br/>in one pass"| V(["modifyAllValidated<br/>Validated, all errors"])
    Q -->|"one error for<br/>a batch job to report"| A(["modifyAllEither<br/>Either, first error only"])

    classDef decision fill:#e5c890,stroke:#df8e1d,color:#232634
    classDef tier fill:#a6d189,stroke:#40a02b,color:#232634
    class Q decision
    class E,M,V,A tier
```

The rest of this section uses three more checks, each as short as `checkPrice`:

~~~admonish example title="The other checks" collapsible=true
``` java
  static Either<String, BigDecimal> checkPriceEither(BigDecimal price) {
    return checkPrice(price).toEither();
  }

  static Either<String, String> checkEmail(String email) {
    return email.contains("@") ? Either.right(email) : Either.left("Invalid email: " + email);
  }

  static Maybe<String> normaliseUsername(String username) {
    String trimmed = username.strip();
    return trimmed.length() >= 3 && trimmed.length() <= 20 ? Maybe.just(trimmed) : Maybe.nothing();
  }

```
~~~

### One field, fail fast {#one-field-fail-fast}

``` java
    Lens<User, String> email = UserFocus.email().toLens();

    Either<String, User> result = OpticOps.modifyEither(user, email, FluentBook::checkEmail);

    String message = result.fold(error -> "rejected: " + error, u -> "accepted: " + u.email());
```

For `alice@example.com`, `message` is `"accepted: alice@example.com"`; for `bob.example.com`, `result` is `Left("Invalid email: bob.example.com")`.

### One field, no detail {#one-field-silent-failure}

``` java
    Maybe<User> normalised =
        OpticOps.modifyMaybe(user, UserFocus.username().toLens(), FluentBook::normaliseUsername);

    User safe = normalised.orElse(user);
```

A username of `"  alice  "` comes back trimmed in a `Just`; one of two letters gives `Nothing`, and `safe` falls back to the user as they were. `modifyMaybe` has the shape of `modifyEither`, minus the explanation, so use it when the caller's next move is a fallback rather than a message.

### Every element, first error only {#every-element-first-error-only}

``` java
    Either<String, Order> firstFailure =
        OpticOps.modifyAllEither(order, prices, FluentBook::checkPriceEither);
```

For the order with two bad prices, `firstFailure` is `Left("Price cannot be negative: -10.00")`.

~~~admonish tip title="Why this matters"
The difference between `modifyAllValidated` and `modifyAllEither` is a product decision, not a technical one. A user filling in a form wants every problem at once; a batch job wants one error and no report. Both are one method call, and the type you get back tells the next reader which decision was made. `Either` keeps only the first error in its *result*, but the traversal still applies your check to every element before the results are combined, so it does not save the work.
~~~

### Sequential validation {#sequential-validation}

`Either` chains, so a fail-fast registration is a `flatMap` per field:

``` java
    Either<String, User> registered =
        OpticOps.modifyEither(user, UserFocus.email().toLens(), FluentBook::checkEmail)
            .flatMap(
                checked ->
                    OpticOps.modifyEither(
                        checked,
                        UserFocus.username().toLens(),
                        name ->
                            name.length() >= 3
                                ? Either.right(name)
                                : Either.left("Username must be at least 3 characters")));
```

A bad email stops the chain with `Left("Invalid email: ...")` before the username is looked at; a good email and a two-letter username give `Left("Username must be at least 3 characters")`.

~~~admonish tip title="You can ship now"
You can now check a field or every element of a list as you update it, and choose whether the caller hears the first error or every one. The rest of this page is for an effect other than these three, and for code that holds an optic rather than a path.
~~~

---

## Any other effect: `modifyF` {#part-3-arbitrary-effects-with-modifyf}

The four methods cover `Either`, `Maybe` and `Validated`. For any other effect, such as fetching a bonus asynchronously, every optic that writes and every path has `modifyF`. It takes an `Applicative`, the object that knows how to combine results inside that effect, and it speaks `Kind`, the library's encoding of a generic container such as `CompletableFuture<A>`. That makes it the mechanism behind `modifyAllValidated` and `modifyAllEither`, at the price of some ceremony at the call site:

~~~admonish example title="Bonuses fetched asynchronously, with `modifyF`" collapsible=true
``` java
@GenerateLenses
record Person(String name, int age, String status) {}

@GenerateLenses
@GenerateFocus
record Player(String name, int score, String status) {}

@GenerateFocus
@GenerateTraversals
record Team(String name, List<Player> players) {}
```

``` java
  static CompletableFuture<Integer> fetchBonus(int score) {
    return CompletableFuture.completedFuture(score + 10);
  }

```

``` java
    Applicative<CompletableFutureKind.Witness> futures = Instances.applicative(completableFuture());

    TraversalPath<Team, Integer> scores = TeamFocus.players().via(PlayerFocus.score());

    Kind<CompletableFutureKind.Witness, Team> pending =
        scores.modifyF(score -> FUTURE.widen(fetchBonus(score)), team, futures);

    CompletableFuture<Team> withBonuses = FUTURE.narrow(pending);
```

For scores of 100 and 85, the future completes with scores of 110 and 95. `FUTURE.widen` and `FUTURE.narrow` convert between `CompletableFuture` and its `Kind`. `modifyAllValidated` is the same call with a `Validated` applicative over a list of errors, each check's error wrapped in a list, and it does that conversion out of sight.
~~~

Reach for `modifyF` for an effect beyond the three, such as `IO`, `CompletableFuture`, `VTask` or your own. Reach for it too for a check that is itself an effect, such as a lookup over the network, and anywhere you already hold an `Applicative`. `OpticOps.modifyF` and `OpticOps.modifyAllF` take the same arguments, source first, for a raw optic. [Type Class and Effect Integration](focus_effects.md) has more.

---

## Field notes {#field-notes}

The rest of this page is for code that holds an optic rather than a path, and for the idioms that recur around `OpticOps`.

### Reads, writes and queries {#part-1-reading-writing-querying}

`OpticOps` restates every read and write, source first, and is overloaded on the optic type, so the same names work whatever you hand them. If you know optics from Haskell or Scala, `get` is `view`, `modify` is `over`, and `preview` keeps its name. These examples use generated `Lenses` and `Traversals` classes:

``` java
@GenerateLenses
record Person(String name, int age, String status) {}

@GenerateLenses
@GenerateFocus
record Player(String name, int score, String status) {}

@GenerateFocus
@GenerateTraversals
record Team(String name, List<Player> players) {}
```

``` java
    Traversal<Team, Integer> playerScores = TeamTraversals.players().andThen(PlayerLenses.score());

    // Read
    String name = OpticOps.get(alice, PersonLenses.name());
    List<Integer> scores = OpticOps.getAll(team, playerScores);
    Optional<Integer> firstScore = OpticOps.preview(team, playerScores);

    // Write
    Person updated = OpticOps.set(alice, PersonLenses.age(), 30);
    Team doubled = OpticOps.modifyAll(team, playerScores, score -> score * 2);

    // Query, without modifying anything
    boolean hasHighScorer = OpticOps.exists(team, playerScores, score -> score > 90);
    boolean allPassed = OpticOps.all(team, playerScores, score -> score >= 50);
    int playerCount = OpticOps.count(team, TeamTraversals.players());
    boolean noPlayers = OpticOps.isEmpty(team, TeamTraversals.players());
    Optional<Player> top =
        OpticOps.find(team, TeamTraversals.players(), player -> player.score() > 90);
```

### Static methods or builders {#the-two-styles}

Nearly every operation exists as a concise static method and as a fluent builder. They compile to the same thing; pick per call site:

``` java
    // Static style
    int age = OpticOps.get(alice, PersonLenses.age());
    Person older = OpticOps.modify(alice, PersonLenses.age(), a -> a + 1);

    // Builder style
    int sameAge = OpticOps.getting(alice).through(PersonLenses.age());
    Person alsoOlder = OpticOps.modifying(alice).through(PersonLenses.age(), a -> a + 1);
```

The static form is shorter, for a one-off operation where naming it twice would be noise. The builder reads better when the optic expression is long, and the IDE's completion list after `OpticOps.modifying(order).` is a decent map of what is possible. Four builders cover reading, setting, modifying and querying:

``` java
    List<Integer> allScores = OpticOps.getting(team).allThrough(playerScores);
    Team reset = OpticOps.setting(team).allThrough(playerScores, 0);
    Team bumped = OpticOps.modifying(team).allThrough(playerScores, score -> score + 5);
    boolean any = OpticOps.querying(team).anyMatch(playerScores, score -> score > 90);
```

The validation methods have a builder too:

``` java
    Either<String, User> checkedEmail =
        OpticOps.modifyingWithValidation(user).throughEither(email, FluentBook::checkEmail);

    Validated<List<String>, Order> checkedPrices =
        OpticOps.modifyingWithValidation(order).allThroughValidated(prices, FluentBook::checkPrice);
```

| Builder | Verbs |
|---------|-------|
| `getting(source)` | `through`, `maybeThrough`, `allThrough` |
| `setting(source)` | `through`, `allThrough` |
| `modifying(source)` | `through`, `allThrough`, `throughF`, `allThroughF` |
| `querying(source)` | `anyMatch`, `allMatch`, `findFirst`, `count`, `isEmpty` |
| `modifyingWithValidation(source)` | `throughEither`, `throughMaybe`, `allThroughValidated`, `allThroughEither` |

`getting(...)` reads values out, so it is the builder that returns a `List` you can stream. `querying(...)` answers questions, and never hands you the whole collection: `findFirst` is the only verb that returns a focused element, and at most one.

### Idioms {#idioms}

**A conditional update.** When the decision depends on one field and the write targets another, read once, decide, then write. `modify` is not the tool here:

``` java
    Person classified =
        OpticOps.get(alice, PersonLenses.age()) >= 18
            ? OpticOps.set(alice, PersonLenses.status(), "ADULT")
            : alice;
```

**An update narrowed by a predicate.** `filtered` narrows the traversal itself, so the update reaches only the elements that qualify, and no membership test leaks into the function:

``` java
    Traversal<Team, Player> topPerformers =
        TeamTraversals.players().filtered(player -> player.score() >= 90);

    Team starred = OpticOps.setAll(team, topPerformers.andThen(PlayerLenses.status()), "STAR");

    List<Player> stars = OpticOps.getAll(starred, topPerformers);
```

For Alice on 100 and Bob on 85, only Alice is starred, and reading `topPerformers` back from `starred` finds her alone.

**An aggregate.** A `Fold` collapses every focused value through a `Monoid`, and a `Traversal` reads as a `Fold` through `asFold()`. For a one-off, `getAll(...).stream()` reads as well; a fold earns its place when the aggregate is itself a value you pass around:

``` java
    int total =
        TeamTraversals.players()
            .andThen(PlayerLenses.score())
            .asFold()
            .foldMap(Monoids.integerAddition(), score -> score, team);
```

**A stream.** Optics get the values out, and the Stream API does the rest:

``` java
    List<String> highScorerNames =
        OpticOps.getting(team).allThrough(TeamTraversals.players()).stream()
            .filter(player -> player.score() > 90)
            .map(Player::name)
            .toList();
```

A multi-step transformation is a sequence of named locals, each stage taking the previous result, rather than one long expression.

### Performance {#performance}

A builder adds one short-lived object to what the operation allocates anyway, which is almost never the reason code is slow. Each `andThen` allocates a small wrapper optic, so compose once, before the loop, and the optic is built once:

``` java
    // Compose once, before the loop
    Traversal<Team, Integer> scores = TeamTraversals.players().andThen(PlayerLenses.score());

    List<List<Integer>> allScores = new ArrayList<>();
    for (Team team : teams) {
      allScores.add(OpticOps.getAll(team, scores));
    }
```

### Pitfalls {#pitfalls}

- **Reading, then setting, when you mean `modify`.** `OpticOps.modify(person, PersonLenses.age(), a -> a + 1)` names the path once, and keeps the read and the write in one expression.
- **Recomposing an optic in a loop.** Hoist the composition, as [Performance](#performance) shows.
- **Asking `querying` for the elements.** It answers questions; `getting(...).allThrough(...)` returns the values.
- **Expecting `modify` on a bare `Traversal`.** Its reads and writes go through the `Traversals` utility or `OpticOps`, as [Using an optic directly](optics_intro.md#using-an-optic-directly) shows. A `TraversalPath` carries `getAll` and `modifyAll` itself.

---

~~~admonish info title="Key Takeaways"
* **A check returns its verdict, and `OpticOps` threads it through the optic.** The answer is a value, so it goes on to combine with other checks instead of ending in a throw.
* **Four methods, chosen by what the caller needs to hear.** Every error for a person filling in a form, the first for a batch job, no detail when the next move is a fallback; none of them skips evaluating an element.
* **The validation methods need no extra plumbing.** Your check returns `Either`, `Maybe` or `Validated`, and that is all the call site sees.
* **`modifyF` is the general case.** It handles any other effect, such as a `CompletableFuture`, at the price of converting the effect at the edges.
* **`OpticOps` takes the source first, and works on raw optics.** Static methods for short call sites, builders when the optic expression is long.
~~~

~~~admonish info title="Hands-On Learning"
Practise the fluent API in [Tutorial 09: Fluent Optics API](https://github.com/higher-kinded-j/higher-kinded-j/blob/main/hkj-examples/src/test/java/org/higherkindedj/tutorial/optics/Tutorial09_FluentOpticsAPI.java) (7 exercises).
~~~

~~~admonish tip title="See Also"
- [Many Edits at Once](multi_edit.md): several edits, validated together, as one REST `PATCH`
- [Validated](../monads/validated_monad.md): the accumulating type behind `modifyAllValidated`
- [Composing Optics for Deep Validation](composing_optics.md): validating a nested structure in one pass
- [Free Monad DSL](free_monad_dsl.md): when the plan itself is the artefact
~~~

~~~admonish tip title="Further Reading"
- **Martin Fowler**: [Fluent Interface](https://martinfowler.com/bliki/FluentInterface.html): the original description of the pattern
~~~

---

**Previous:** [What a Path Is Made Of](optics_intro.md)
**Next:** [Many Edits at Once](multi_edit.md)
