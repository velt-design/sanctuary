import { Container, Eyebrow, Heading, Text, TextLink } from '../marketing-foundation/Primitives';
import { PRODUCT_FORM_CHOICES } from './productDesigns';
import ProductCard from './ProductCard';
import ProductFormComparison from './ProductFormComparison';
import styles from './product-hub.module.css';



export default function PergolaSelection() {
  return <section className={styles.selection} id="pergola-forms" aria-labelledby="products-title">
    <Container width="wide">
      <header className={styles.intro}>
        <div><Eyebrow>Sanctuary pergolas</Eyebrow><Heading as="h1" id="products-title" variant="display">Find your pergola.</Heading></div>
        <div><Text size="large">Start with the roofline. Make it yours with the size, roofing and sides that suit your home.</Text><TextLink href="#bespoke-design">Looking for a bespoke design?</TextLink></div>
      </header>
      <div className={styles.grid} data-product-form-grid>{PRODUCT_FORM_CHOICES.map((choice, index) => <ProductCard key={choice.type} {...choice} priority={index === 0}/>)}</div>
      <p className={styles.note}>Example estimates include standard installation allowances. Your size, options and site determine the final price. Explore a product to personalise it or return to your saved choices.</p>
      <details className={styles.comparison}><summary>Compare rooflines in more detail <span aria-hidden="true">+</span></summary><ProductFormComparison/></details>
    </Container>
  </section>;
}
