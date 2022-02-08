import Fastify from "fastify";

const fastify = Fastify({
  logger: true
})

// Declare a route
fastify.get('/user/login', (request, reply) => {
  reply.send({ test: 3 })
})

// Run the server!
fastify.listen(3000, (err, address) => {
  if (err) throw err
  // Server is now listening on ${address}
})
