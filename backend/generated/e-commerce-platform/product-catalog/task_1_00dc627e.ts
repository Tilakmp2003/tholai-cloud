import React, { useEffect, useState } from 'react';
import {
  Box,
  SimpleGrid,
  Image,
  Text,
  Heading,
  Container,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  Stack,
  useToast,
} from '@chakra-ui/react';

/**
 * Renders the main product listing page component.
 * Fetches product data from /api/products and displays them
 * in a responsive grid using Chakra UI components.
 * Includes loading indicators and error handling.
 *
 * Assumes ChakraProvider is set up in the root of the application.
 */
const ProductListingPage = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null); // Clear any previous errors

        const response = await fetch('/api/products');

        if (!response.ok) {
          // Attempt to read error message from response if available
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setProducts(data);
      } catch (err) {
        console.error('Failed to fetch products:', err);
        setError('Failed to load products. Please try again later.');
        toast({
          title: 'Error loading products.',
          description: err.message || 'An unexpected error occurred.',
          status: 'error',
          duration: 9000,
          isClosable: true,
          position: 'top-right',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [toast]); // `toast` is stable, but included for completeness

  if (isLoading) {
    return (
      <Center p={8} minH="70vh" flexDirection="column">
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="xl"
          aria-label="Loading products"
        />
        <Text mt={4} fontSize="lg" color="gray.600">Loading products...</Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Container maxW="container.xl" p={4} minH="70vh">
        <Alert
          status="error"
          variant="subtle"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          height="200px"
          borderRadius="md"
        >
          <AlertIcon boxSize="40px" mr={0} />
          <AlertTitle mt={4} mb={1} fontSize="lg">
            {error}
          </AlertTitle>
          <AlertDescription maxWidth="sm">
            There was an issue fetching product data. Please check your network connection or try again later.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Heading as="h1" size="xl" mb={8} textAlign="center" color="gray.800">
        Our Products
      </Heading>

      {products.length === 0 ? (
        <Center minH="50vh">
          <Text fontSize="lg" color="gray.500">No products found at this time.</Text>
        </Center>
      ) : (
        <SimpleGrid
          columns={{ base: 1, sm: 2, md: 3, lg: 4 }} // Responsive grid columns
          spacing={6}
          minChildWidth="250px" // Ensures cards don't get too small on wider screens
        >
          {products.map((product) => (
            <Card
              key={product.id}
              maxW="sm"
              borderRadius="lg"
              overflow="hidden"
              boxShadow="md"
              _hover={{ boxShadow: 'xl', transform: 'translateY(-2px)' }}
              transition="all 0.2s ease-in-out"
            >
              <Image
                src={product.imageUrl || 'https://via.placeholder.com/200?text=No+Image'}
                alt={product.name}
                objectFit="cover"
                height="200px"
                width="100%"
                fallbackSrc="https://via.placeholder.com/200?text=Image+Unavailable" // Fallback if image fails to load
              />
              <CardBody>
                <Stack spacing="3">
                  <Heading size="md" noOfLines={1} color="gray.700">
                    {product.name}
                  </Heading>
                  <Text color="blue.600" fontSize="2xl" fontWeight="bold">
                    ${product.price ? product.price.toFixed(2) : 'N/A'}
                  </Text>
                  {/* Additional product details can be added here */}
                </Stack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
};

export default ProductListingPage;