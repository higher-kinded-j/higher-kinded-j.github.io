// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="home.html">Introduction to Higher-Kinded-J</a></li><li class="chapter-item expanded affix "><li class="part-title">Higher-Kinded Types</li><li class="chapter-item expanded "><a href="hkts/hkt_introduction.html"><strong aria-hidden="true">1.</strong> HKT Introduction</a><a class="toggle"><div>❱</div></a></li><li><ol class="section"><li class="chapter-item "><a href="hkts/core-concepts.html"><strong aria-hidden="true">1.1.</strong> Concepts</a></li><li class="chapter-item "><a href="hkts/usage-guide.html"><strong aria-hidden="true">1.2.</strong> Usage Guide</a></li><li class="chapter-item "><a href="hkts/extending-simulation.html"><strong aria-hidden="true">1.3.</strong> Extending</a></li></ol></li><li class="chapter-item expanded "><a href="functional/for_comprehension.html"><strong aria-hidden="true">2.</strong> For Comprehension</a></li><li class="chapter-item expanded "><a href="monads/supported-types.html"><strong aria-hidden="true">3.</strong> Monads</a><a class="toggle"><div>❱</div></a></li><li><ol class="section"><li class="chapter-item "><a href="monads/cf_monad.html"><strong aria-hidden="true">3.1.</strong> CompletableFuture</a></li><li class="chapter-item "><a href="monads/either_monad.html"><strong aria-hidden="true">3.2.</strong> Either</a></li><li class="chapter-item "><a href="monads/identity.html"><strong aria-hidden="true">3.3.</strong> Identity</a></li><li class="chapter-item "><a href="monads/io_monad.html"><strong aria-hidden="true">3.4.</strong> IO</a></li><li class="chapter-item "><a href="monads/lazy_monad.html"><strong aria-hidden="true">3.5.</strong> Lazy</a></li><li class="chapter-item "><a href="monads/list_monad.html"><strong aria-hidden="true">3.6.</strong> List</a></li><li class="chapter-item "><a href="monads/maybe_monad.html"><strong aria-hidden="true">3.7.</strong> Maybe</a></li><li class="chapter-item "><a href="monads/optional_monad.html"><strong aria-hidden="true">3.8.</strong> Optional</a></li><li class="chapter-item "><a href="monads/reader_monad.html"><strong aria-hidden="true">3.9.</strong> Reader</a></li><li class="chapter-item "><a href="monads/state_monad.html"><strong aria-hidden="true">3.10.</strong> State</a></li><li class="chapter-item "><a href="monads/try_monad.html"><strong aria-hidden="true">3.11.</strong> Try</a></li><li class="chapter-item "><a href="monads/validated_monad.html"><strong aria-hidden="true">3.12.</strong> Validated</a></li><li class="chapter-item "><a href="monads/writer_monad.html"><strong aria-hidden="true">3.13.</strong> Writer</a></li><li class="chapter-item "><a href="monads/monad_zero.html"><strong aria-hidden="true">3.14.</strong> MonadZero</a></li></ol></li><li class="chapter-item expanded "><a href="transformers/transformers.html"><strong aria-hidden="true">4.</strong> Monad Transformers</a><a class="toggle"><div>❱</div></a></li><li><ol class="section"><li class="chapter-item "><a href="transformers/eithert_transformer.html"><strong aria-hidden="true">4.1.</strong> EitherT</a></li><li class="chapter-item "><a href="transformers/optionalt_transformer.html"><strong aria-hidden="true">4.2.</strong> OptionalT</a></li><li class="chapter-item "><a href="transformers/maybet_transformer.html"><strong aria-hidden="true">4.3.</strong> MaybeT</a></li><li class="chapter-item "><a href="transformers/readert_transformer.html"><strong aria-hidden="true">4.4.</strong> ReaderT</a></li><li class="chapter-item "><a href="transformers/statet_transformer.html"><strong aria-hidden="true">4.5.</strong> StateT</a></li></ol></li><li class="chapter-item expanded "><li class="part-title">HKT Examples</li><li class="chapter-item expanded "><a href="hkts/hkt_basic_examples.html"><strong aria-hidden="true">5.</strong> How to use HKTs</a></li><li class="chapter-item expanded "><a href="hkts/order-walkthrough.html"><strong aria-hidden="true">6.</strong> An Order Workflow</a></li><li class="chapter-item expanded "><a href="hkts/draughts.html"><strong aria-hidden="true">7.</strong> Draughts Game</a></li><li class="chapter-item expanded affix "><li class="part-title">Optics</li><li class="chapter-item expanded "><a href="optics/optics_intro.html"><strong aria-hidden="true">8.</strong> Optics Introduction</a></li><li class="chapter-item expanded "><a href="optics/lenses.html"><strong aria-hidden="true">9.</strong> Lenses</a></li><li class="chapter-item expanded "><a href="optics/prisms.html"><strong aria-hidden="true">10.</strong> Prisms</a></li><li class="chapter-item expanded "><a href="optics/iso.html"><strong aria-hidden="true">11.</strong> Isomorphisms</a></li><li class="chapter-item expanded "><a href="optics/traversals.html"><strong aria-hidden="true">12.</strong> Traversals</a></li><li class="chapter-item expanded "><a href="optics/composing_optics.html"><strong aria-hidden="true">13.</strong> Combining Optics - Validation</a></li><li class="chapter-item expanded affix "><li class="part-title">Optics Examples</li><li class="chapter-item expanded "><a href="optics/optics_examples.html"><strong aria-hidden="true">14.</strong> How to use Optics</a></li><li class="chapter-item expanded "><a href="optics/auditing_complex_data_example.html"><strong aria-hidden="true">15.</strong> Auditing Complex Data - The Power of Optics</a></li><li class="chapter-item expanded affix "><li class="part-title">More Functional Thinking</li><li class="chapter-item expanded "><a href="reading.html"><strong aria-hidden="true">16.</strong> Blog series</a></li><li class="chapter-item expanded affix "><li class="part-title">Project Info</li><li class="chapter-item expanded "><a href="CONTRIBUTING.html"><strong aria-hidden="true">17.</strong> Contributing</a></li><li class="chapter-item expanded "><a href="CODE_OF_CONDUCT.html"><strong aria-hidden="true">18.</strong> Code of Conduct</a></li><li class="chapter-item expanded "><a href="LICENSE.html"><strong aria-hidden="true">19.</strong> License</a></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0].split("?")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
