import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import ProductDetailContent from '@/components/products/ProductDetailContent'
import { CONTENT_CONTAINER } from '@/lib/content-container'
import { getAllProductSlugs } from '@/lib/product-data'
import { getProductDetailData } from '@/lib/product-detail'

type ProductPageProps = {
  params: Promise<{ slug: string }>
}

/**
 * Static / ISR instead of dynamic: every active product is prerendered at
 * build and refreshed every five minutes, the same window as the readers
 * behind this page (`DEFAULT_PUBLIC_REVALIDATE` in `lib/cache-tags.ts`).
 * Segment config must be statically analyzable, so the value is the literal.
 *
 * `dynamicParams` stays at its default (`true`): a product added afterwards
 * renders on first visit and is cached from then on, and every admin write
 * revalidates this template through `revalidateStorefront()`.
 */
export const revalidate = 300

/**
 * Returns `[]` if the catalogue cannot be read: `dynamicParams` renders those
 * paths on first visit, so a database hiccup must never fail the build here.
 */
export async function generateStaticParams() {
  try {
    const slugs = await getAllProductSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch (error) {
    console.error('[product] generateStaticParams could not read products.', error)
    return []
  }
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductDetailData(slug)

  if (!product) {
    return {
      title: "Product not found | ZUHA'S",
    }
  }

  return {
    title: `${product.name} | ZUHA'S`,
    description: product.description ?? undefined,
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await getProductDetailData(slug)

  if (!product) {
    notFound()
  }

  return (
    <div className={CONTENT_CONTAINER}>
      <nav
        aria-label="Breadcrumb"
        className="mb-6 mt-2 text-xs uppercase tracking-[0.16em] text-black/60 sm:mb-8 sm:mt-4"
      >
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/" className="hover:text-black">
              Home
            </Link>
          </li>
          <li aria-hidden="true">{' > '}</li>
          {product.category ? (
            <>
              <li>
                <Link href={`/category/${product.category.slug}`} className="hover:text-black">
                  {product.category.name.toUpperCase()}
                </Link>
              </li>
              <li aria-hidden="true">{' > '}</li>
            </>
          ) : null}
          {product.subCategory ? (
            <>
              <li>
                <Link
                  href={`/category/${product.category?.slug}/${product.subCategory.slug}`}
                  className="hover:text-black"
                >
                  {product.subCategory.name.toUpperCase()}
                </Link>
              </li>
              <li aria-hidden="true">{' > '}</li>
            </>
          ) : null}
          <li className="text-black">{product.name.toUpperCase()}</li>
        </ol>
      </nav>

      <ProductDetailContent product={product} />
    </div>
  )
}
