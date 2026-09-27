import PolarProviderService from "./service"

/**
 * Module-provider export shape required by the Medusa module loaders: the
 * resolved module must expose a `services` array (a bare class is not
 * iterable and crashes loading with "moduleProviderServices is not
 * iterable").
 */
export const services = [PolarProviderService]

export default {
  services: [PolarProviderService],
}
